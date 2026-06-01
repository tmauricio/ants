use anyhow::{bail, Context, Result};
use git2::{
    BranchType, DiffOptions, IndexAddOption, MergeOptions, ObjectType, Repository,
    Sort, Status,
};
use serde::Serialize;

use crate::graph::{self, GraphRow};

// ── Types returned to frontend ──────────────────────────────────────────────

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub tip_oid: String,
}

#[derive(Serialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

#[derive(Serialize)]
pub struct TagInfo {
    pub name: String,
    pub oid: String,
}

#[derive(Serialize)]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub oid: String,
}

#[derive(Serialize)]
pub struct StatusEntry {
    pub path: String,
    pub status: String, // "new", "modified", "deleted", "renamed", "conflict"
    pub staged: bool,
}

#[derive(Serialize)]
pub struct CommitDetail {
    pub oid: String,
    pub short_oid: String,
    pub summary: String,
    pub body: String,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub committer_name: String,
    pub committer_time: i64,
    pub parents: Vec<String>,
    pub files: Vec<FileDiff>,
}

#[derive(Serialize)]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "added", "deleted", "modified", "renamed"
    pub additions: usize,
    pub deletions: usize,
    pub patch: String,
}

// ── Log / graph ──────────────────────────────────────────────────────────────

pub fn get_log(repo_path: &str, max_count: usize) -> Result<Vec<GraphRow>> {
    let repo = Repository::open(repo_path)?;

    // Collect all branch tips so we can label commits
    let mut ref_map: std::collections::HashMap<String, Vec<String>> = Default::default();

    if let Ok(branches) = repo.branches(None) {
        for branch in branches.flatten() {
            let (branch, _) = branch;
            if let (Ok(name), Ok(Some(oid))) =
                (branch.name(), branch.get().resolve().map(|r| r.target()))
            {
                ref_map
                    .entry(oid.to_string())
                    .or_default()
                    .push(name.unwrap_or("").to_string());
            }
        }
    }
    if let Ok(tags) = repo.tag_names(None) {
        for tag in tags.iter().flatten() {
            if let Ok(obj) = repo.revparse_single(&format!("refs/tags/{}", tag)) {
                let oid = obj.peel_to_commit().map(|c| c.id()).unwrap_or(obj.id());
                ref_map
                    .entry(oid.to_string())
                    .or_default()
                    .push(format!("tag: {}", tag));
            }
        }
    }

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL)?;

    // Push all branch heads
    if revwalk.push_glob("refs/heads/*").is_err() {
        revwalk.push_head().ok();
    }
    revwalk.push_glob("refs/remotes/*").ok();

    let mut inputs: Vec<graph::CommitInput> = Vec::with_capacity(max_count);

    for oid in revwalk.take(max_count) {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        let oid_str = oid.to_string();
        let short_oid = oid_str[..8].to_string();
        let summary = commit.summary().unwrap_or("").to_string();
        let author = commit.author();
        let parents: Vec<String> = (0..commit.parent_count())
            .map(|i| commit.parent_id(i).map(|o| o.to_string()).unwrap_or_default())
            .collect();
        let refs = ref_map.get(&oid_str).cloned().unwrap_or_default();

        inputs.push(graph::CommitInput {
            oid: oid_str,
            short_oid,
            summary,
            author_name: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            author_time: author.when().seconds(),
            parents,
            refs,
        });
    }

    Ok(graph::layout(inputs))
}

// ── Commit detail ─────────────────────────────────────────────────────────────

pub fn get_commit_detail(repo_path: &str, oid_str: &str) -> Result<CommitDetail> {
    let repo = Repository::open(repo_path)?;
    let oid = git2::Oid::from_str(oid_str)?;
    let commit = repo.find_commit(oid)?;

    let summary = commit.summary().unwrap_or("").to_string();
    let body = commit.body().unwrap_or("").to_string();
    let author = commit.author();
    let committer = commit.committer();
    let parents: Vec<String> = (0..commit.parent_count())
        .map(|i| commit.parent_id(i).map(|o| o.to_string()).unwrap_or_default())
        .collect();

    // Diff against first parent (or empty tree for root commits)
    let mut diff_opts = DiffOptions::new();
    diff_opts.context_lines(3);

    let diff = if commit.parent_count() > 0 {
        let parent = commit.parent(0)?;
        let old_tree = parent.tree()?;
        let new_tree = commit.tree()?;
        repo.diff_tree_to_tree(Some(&old_tree), Some(&new_tree), Some(&mut diff_opts))?
    } else {
        let new_tree = commit.tree()?;
        repo.diff_tree_to_tree(None, Some(&new_tree), Some(&mut diff_opts))?
    };

    let mut files: Vec<FileDiff> = Vec::new();

    diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
        let idx = delta.new_file().path().map(|p| p.to_string_lossy().to_string());
        if let Some(path) = idx {
            // Find or create file entry
            let entry = match files.iter_mut().find(|f| f.path == path) {
                Some(f) => f,
                None => {
                    let status = match delta.status() {
                        git2::Delta::Added => "added",
                        git2::Delta::Deleted => "deleted",
                        git2::Delta::Renamed => "renamed",
                        _ => "modified",
                    };
                    let old_path = delta
                        .old_file()
                        .path()
                        .map(|p| p.to_string_lossy().to_string())
                        .filter(|p| p != &path);
                    files.push(FileDiff {
                        path: path.clone(),
                        old_path,
                        status: status.to_string(),
                        additions: 0,
                        deletions: 0,
                        patch: String::new(),
                    });
                    files.last_mut().unwrap()
                }
            };

            match line.origin() {
                '+' => entry.additions += 1,
                '-' => entry.deletions += 1,
                _ => {}
            }

            let text = std::str::from_utf8(line.content()).unwrap_or("");
            entry.patch.push_str(&format!("{}{}", line.origin(), text));
        }
        true
    })?;

    Ok(CommitDetail {
        oid: oid_str.to_string(),
        short_oid: oid_str[..8].to_string(),
        summary,
        body,
        author_name: author.name().unwrap_or("").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        author_time: author.when().seconds(),
        committer_name: committer.name().unwrap_or("").to_string(),
        committer_time: committer.when().seconds(),
        parents,
        files,
    })
}

// ── Branches ─────────────────────────────────────────────────────────────────

pub fn get_branches(repo_path: &str) -> Result<Vec<BranchInfo>> {
    let repo = Repository::open(repo_path)?;
    let head_oid = repo.head().ok().and_then(|h| h.target());

    let mut result = Vec::new();
    for branch in repo.branches(None)?.flatten() {
        let (branch, btype) = branch;
        let name = branch.name()?.unwrap_or("").to_string();
        let tip_oid = branch
            .get()
            .resolve()
            .ok()
            .and_then(|r| r.target())
            .map(|o| o.to_string())
            .unwrap_or_default();

        let is_head = matches!(btype, BranchType::Local)
            && head_oid.map(|h| h.to_string() == tip_oid).unwrap_or(false)
            && branch.is_head();

        let upstream = if matches!(btype, BranchType::Local) {
            branch
                .upstream()
                .ok()
                .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()))
        } else {
            None
        };

        result.push(BranchInfo {
            name,
            is_head,
            upstream,
            tip_oid,
        });
    }
    Ok(result)
}

pub fn get_remotes(repo_path: &str) -> Result<Vec<RemoteInfo>> {
    let repo = Repository::open(repo_path)?;
    let names = repo.remotes()?;
    let mut result = Vec::new();
    for name in names.iter().flatten() {
        if let Ok(remote) = repo.find_remote(name) {
            result.push(RemoteInfo {
                name: name.to_string(),
                url: remote.url().unwrap_or("").to_string(),
            });
        }
    }
    Ok(result)
}

pub fn get_tags(repo_path: &str) -> Result<Vec<TagInfo>> {
    let repo = Repository::open(repo_path)?;
    let names = repo.tag_names(None)?;
    let mut result = Vec::new();
    for name in names.iter().flatten() {
        if let Ok(obj) = repo.revparse_single(&format!("refs/tags/{}", name)) {
            let oid = obj.peel_to_commit().map(|c| c.id()).unwrap_or(obj.id());
            result.push(TagInfo {
                name: name.to_string(),
                oid: oid.to_string(),
            });
        }
    }
    Ok(result)
}

// ── Stashes ───────────────────────────────────────────────────────────────────

pub fn get_stashes(repo_path: &str) -> Result<Vec<StashInfo>> {
    let mut repo = Repository::open(repo_path)?;
    let mut stashes = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        stashes.push(StashInfo {
            index,
            message: message.to_string(),
            oid: oid.to_string(),
        });
        true
    })?;
    Ok(stashes)
}

// ── Working directory status ──────────────────────────────────────────────────

pub fn get_status(repo_path: &str) -> Result<Vec<StatusEntry>> {
    let repo = Repository::open(repo_path)?;
    let statuses = repo.statuses(None)?;
    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        let (staged_status, unstaged_status) = classify_status(s);

        if let Some(st) = staged_status {
            result.push(StatusEntry {
                path: path.clone(),
                status: st.to_string(),
                staged: true,
            });
        }
        if let Some(st) = unstaged_status {
            result.push(StatusEntry {
                path,
                status: st.to_string(),
                staged: false,
            });
        }
    }

    Ok(result)
}

fn classify_status(s: Status) -> (Option<&'static str>, Option<&'static str>) {
    let staged = if s.contains(Status::INDEX_NEW) {
        Some("new")
    } else if s.contains(Status::INDEX_MODIFIED) {
        Some("modified")
    } else if s.contains(Status::INDEX_DELETED) {
        Some("deleted")
    } else if s.contains(Status::INDEX_RENAMED) {
        Some("renamed")
    } else {
        None
    };

    let unstaged = if s.contains(Status::WT_NEW) {
        Some("new")
    } else if s.contains(Status::WT_MODIFIED) {
        Some("modified")
    } else if s.contains(Status::WT_DELETED) {
        Some("deleted")
    } else if s.contains(Status::CONFLICTED) {
        Some("conflict")
    } else {
        None
    };

    (staged, unstaged)
}

// ── Branch operations ─────────────────────────────────────────────────────────

pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let branch_ref = repo.find_branch(branch_name, BranchType::Local)?;
    let obj = branch_ref.get().peel(ObjectType::Commit)?;
    repo.checkout_tree(&obj, None)?;
    repo.set_head(&format!("refs/heads/{}", branch_name))?;
    Ok(())
}

pub fn create_branch(repo_path: &str, name: &str, from_oid: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let oid = git2::Oid::from_str(from_oid)?;
    let commit = repo.find_commit(oid)?;
    repo.branch(name, &commit, false)?;
    Ok(())
}

pub fn delete_branch(repo_path: &str, name: &str, force: bool) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut branch = repo.find_branch(name, BranchType::Local)?;
    branch.delete()?;
    let _ = force; // git2's delete is always safe; force is for future use
    Ok(())
}

pub fn merge_branch(repo_path: &str, branch_name: &str) -> Result<String> {
    let repo = Repository::open(repo_path)?;
    let branch = repo.find_branch(branch_name, BranchType::Local)?;
    let branch_commit = branch.get().peel_to_commit()?;
    let annotated = repo.reference_to_annotated_commit(branch.get())?;

    let (analysis, _) = repo.merge_analysis(&[&annotated])?;

    if analysis.is_up_to_date() {
        return Ok("Already up to date.".to_string());
    }

    if analysis.is_fast_forward() {
        let reference = repo.find_reference(&format!("refs/heads/{}", branch_name))?;
        let head_ref = repo.head()?;
        let head_name = head_ref.shorthand().unwrap_or("HEAD").to_string();
        let mut head_ref = repo.find_reference(&format!("refs/heads/{}", head_name))?;
        head_ref.set_target(branch_commit.id(), "fast-forward merge")?;
        repo.set_head(&format!("refs/heads/{}", head_name))?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        let _ = reference;
        return Ok("Fast-forward.".to_string());
    }

    // Normal merge
    let mut merge_opts = MergeOptions::new();
    repo.merge(&[&annotated], Some(&mut merge_opts), None)?;

    if repo.index()?.has_conflicts() {
        bail!("Merge conflicts detected. Resolve them manually.");
    }

    // Auto-commit the merge
    let sig = repo.signature()?;
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;
    let head_commit = repo.head()?.peel_to_commit()?;
    let msg = format!("Merge branch '{}'", branch_name);
    repo.commit(Some("HEAD"), &sig, &sig, &msg, &tree, &[&head_commit, &branch_commit])?;
    repo.cleanup_state()?;

    Ok(format!("Merged '{}'.", branch_name))
}

// ── Staging / committing ──────────────────────────────────────────────────────

pub fn stage_file(repo_path: &str, file_path: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut index = repo.index()?;
    index.add_path(std::path::Path::new(file_path))?;
    index.write()?;
    Ok(())
}

pub fn unstage_file(repo_path: &str, file_path: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let head = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    if let Some(commit) = head {
        let tree = commit.tree()?;
        repo.reset_default(Some(tree.as_object()), [file_path])?;
    } else {
        // No commits yet — just remove from index
        let mut index = repo.index()?;
        index.remove_path(std::path::Path::new(file_path))?;
        index.write()?;
    }
    Ok(())
}

pub fn stage_all(repo_path: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn discard_file(repo_path: &str, file_path: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut opts = git2::build::CheckoutBuilder::new();
    opts.force().path(file_path);
    repo.checkout_head(Some(&mut opts))?;
    Ok(())
}

pub fn commit(repo_path: &str, message: &str) -> Result<String> {
    let repo = Repository::open(repo_path)?;
    let sig = repo.signature().context("No git identity configured. Set user.name and user.email.")?;
    let mut index = repo.index()?;
    let tree_oid = index.write_tree()?;
    let tree = repo.find_tree(tree_oid)?;

    let parent_commits: Vec<git2::Commit> = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok())
        .into_iter()
        .collect();
    let parents: Vec<&git2::Commit> = parent_commits.iter().collect();

    let oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
    Ok(oid.to_string())
}

// ── Remote operations ─────────────────────────────────────────────────────────

pub fn fetch(repo_path: &str, remote_name: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut remote = repo.find_remote(remote_name)?;
    remote.fetch(&[] as &[&str], None, None)?;
    Ok(())
}

pub fn push(repo_path: &str, remote_name: &str, branch: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let mut remote = repo.find_remote(remote_name)?;
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    remote.push(&[refspec.as_str()], None)?;
    Ok(())
}

pub fn pull(repo_path: &str) -> Result<String> {
    let repo = Repository::open(repo_path)?;
    let head = repo.head()?;
    let branch_name = head.shorthand().unwrap_or("HEAD").to_string();

    // Find the tracking remote
    let branch = repo.find_branch(&branch_name, BranchType::Local)?;
    let upstream = branch
        .upstream()
        .context("No upstream configured for current branch.")?;
    let remote_name = upstream
        .name()?
        .unwrap_or("origin")
        .split('/')
        .next()
        .unwrap_or("origin")
        .to_string();

    let mut remote = repo.find_remote(&remote_name)?;
    remote.fetch(&[] as &[&str], None, None)?;

    merge_branch(repo_path, &format!("{}/{}", remote_name, branch_name))
        .unwrap_or_else(|e| e.to_string());

    Ok(format!("Pulled from {}/{}.", remote_name, branch_name))
}

// ── Tags ──────────────────────────────────────────────────────────────────────

pub fn create_tag(repo_path: &str, name: &str, oid_str: &str, message: Option<&str>) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    let oid = git2::Oid::from_str(oid_str)?;
    let obj = repo.find_object(oid, None)?;
    if let Some(msg) = message {
        let sig = repo.signature()?;
        repo.tag(name, &obj, &sig, msg, false)?;
    } else {
        repo.tag_lightweight(name, &obj, false)?;
    }
    Ok(())
}

pub fn delete_tag(repo_path: &str, name: &str) -> Result<()> {
    let repo = Repository::open(repo_path)?;
    repo.tag_delete(name)?;
    Ok(())
}

// ── Stash ─────────────────────────────────────────────────────────────────────

pub fn stash_push(repo_path: &str, message: Option<&str>) -> Result<()> {
    let mut repo = Repository::open(repo_path)?;
    let sig = repo.signature()?;
    let msg = message.unwrap_or("WIP stash");
    repo.stash_save(&sig, msg, None)?;
    Ok(())
}

pub fn stash_pop(repo_path: &str, index: usize) -> Result<()> {
    let mut repo = Repository::open(repo_path)?;
    repo.stash_pop(index, None)?;
    Ok(())
}

pub fn stash_drop(repo_path: &str, index: usize) -> Result<()> {
    let mut repo = Repository::open(repo_path)?;
    repo.stash_drop(index)?;
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Detect repo name from path (last component or remote URL basename)
pub fn repo_name_from_path(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

pub fn validate_repo(path: &str) -> Result<()> {
    Repository::open(path).map(|_| ()).context("Not a valid git repository")
}

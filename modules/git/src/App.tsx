import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  RepoEntry, GraphRow, BranchInfo, TagInfo, StashInfo, StatusEntry,
  CommitDetail as CommitDetailType,
} from "./types";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import CommitGraph from "./components/CommitGraph";
import CommitDetailPanel from "./components/CommitDetail";
import WorkingDir from "./components/WorkingDir";

export type RightPanel = { kind: "commit"; oid: string } | { kind: "wip" } | null;

export default function App() {
  const [repos, setRepos] = useState<RepoEntry[]>([]);
  const [activeRepo, setActiveRepo] = useState<RepoEntry | null>(null);
  const [log, setLog] = useState<GraphRow[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [stashes, setStashes] = useState<StashInfo[]>([]);
  const [status, setStatus] = useState<StatusEntry[]>([]);
  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<CommitDetailType | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<RepoEntry[]>("get_repos").then(setRepos).catch(console.error);
  }, []);

  const loadRepo = useCallback(async (repo: RepoEntry) => {
    setLoading(true);
    setError(null);
    setLog([]);
    setBranches([]);
    setTags([]);
    setStashes([]);
    setStatus([]);
    setSelectedOid(null);
    setCommitDetail(null);
    setRightPanel(null);
    try {
      const [logData, branchData, tagData, stashData, statusData] = await Promise.all([
        invoke<GraphRow[]>("get_log", { repoPath: repo.path, maxCount: 500 }),
        invoke<BranchInfo[]>("get_branches", { repoPath: repo.path }),
        invoke<TagInfo[]>("get_tags", { repoPath: repo.path }),
        invoke<StashInfo[]>("get_stashes", { repoPath: repo.path }),
        invoke<StatusEntry[]>("get_status", { repoPath: repo.path }),
      ]);
      setLog(logData);
      setBranches(branchData);
      setTags(tagData);
      setStashes(stashData);
      setStatus(statusData);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const selectRepo = useCallback((repo: RepoEntry) => {
    setActiveRepo(repo);
    loadRepo(repo);
  }, [loadRepo]);

  const handleAddRepo = useCallback(async (path: string) => {
    try {
      const entry = await invoke<RepoEntry>("add_repo", { path });
      const updated = await invoke<RepoEntry[]>("get_repos");
      setRepos(updated);
      selectRepo(entry);
    } catch (e) {
      setError(String(e));
    }
  }, [selectRepo]);

  const handleRemoveRepo = useCallback(async (id: string) => {
    await invoke("remove_repo", { id });
    const updated = await invoke<RepoEntry[]>("get_repos");
    setRepos(updated);
    if (activeRepo?.id === id) {
      setActiveRepo(null);
      setLog([]);
    }
  }, [activeRepo]);

  const selectCommit = useCallback(async (oid: string) => {
    if (!activeRepo) return;
    setSelectedOid(oid);
    setRightPanel({ kind: "commit", oid });
    try {
      const detail = await invoke<CommitDetailType>("get_commit_detail", {
        repoPath: activeRepo.path,
        oid,
      });
      setCommitDetail(detail);
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo]);

  const selectWip = useCallback(() => {
    setSelectedOid("__wip__");
    setRightPanel({ kind: "wip" });
    setCommitDetail(null);
  }, []);

  const refresh = useCallback(() => {
    if (activeRepo) loadRepo(activeRepo);
  }, [activeRepo, loadRepo]);

  const handleFetch = useCallback(async () => {
    if (!activeRepo) return;
    try {
      await invoke("fetch", { repoPath: activeRepo.path, remoteName: "origin" });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const handlePull = useCallback(async () => {
    if (!activeRepo) return;
    try {
      await invoke("pull", { repoPath: activeRepo.path });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const handlePush = useCallback(async () => {
    if (!activeRepo) return;
    const head = branches.find((b) => b.is_head);
    if (!head) return;
    try {
      await invoke("push", {
        repoPath: activeRepo.path,
        remoteName: "origin",
        branch: head.name,
      });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, branches, refresh]);

  const handleCheckout = useCallback(async (branchName: string) => {
    if (!activeRepo) return;
    try {
      await invoke("checkout_branch", { repoPath: activeRepo.path, branchName });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const handleCreateBranch = useCallback(async (name: string, fromOid: string) => {
    if (!activeRepo) return;
    try {
      await invoke("create_branch", { repoPath: activeRepo.path, name, fromOid });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const handleDeleteBranch = useCallback(async (name: string) => {
    if (!activeRepo) return;
    try {
      await invoke("delete_branch", { repoPath: activeRepo.path, name, force: false });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const handleStageFile = useCallback(async (path: string) => {
    if (!activeRepo) return;
    await invoke("stage_file", { repoPath: activeRepo.path, filePath: path });
    const updated = await invoke<StatusEntry[]>("get_status", { repoPath: activeRepo.path });
    setStatus(updated);
  }, [activeRepo]);

  const handleUnstageFile = useCallback(async (path: string) => {
    if (!activeRepo) return;
    await invoke("unstage_file", { repoPath: activeRepo.path, filePath: path });
    const updated = await invoke<StatusEntry[]>("get_status", { repoPath: activeRepo.path });
    setStatus(updated);
  }, [activeRepo]);

  const handleStageAll = useCallback(async () => {
    if (!activeRepo) return;
    await invoke("stage_all", { repoPath: activeRepo.path });
    const updated = await invoke<StatusEntry[]>("get_status", { repoPath: activeRepo.path });
    setStatus(updated);
  }, [activeRepo]);

  const handleCommit = useCallback(async (message: string) => {
    if (!activeRepo) return;
    try {
      await invoke("commit_changes", { repoPath: activeRepo.path, message });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const handleStashPush = useCallback(async () => {
    if (!activeRepo) return;
    try {
      await invoke("stash_push", { repoPath: activeRepo.path, message: null });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const handleStashPop = useCallback(async (index: number) => {
    if (!activeRepo) return;
    try {
      await invoke("stash_pop", { repoPath: activeRepo.path, index });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [activeRepo, refresh]);

  const s: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  };

  const body: React.CSSProperties = {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  };

  return (
    <div style={s}>
      <TopBar
        repos={repos}
        activeRepo={activeRepo}
        onSelectRepo={selectRepo}
        onAddRepo={handleAddRepo}
        onRemoveRepo={handleRemoveRepo}
        onFetch={handleFetch}
        onPull={handlePull}
        onPush={handlePush}
        onRefresh={refresh}
      />

      {error && (
        <div style={{
          background: "rgba(248,81,73,0.15)",
          borderBottom: "1px solid #f85149",
          color: "#f85149",
          padding: "6px 16px",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", color: "#f85149", fontSize: 14, padding: "0 4px", cursor: "pointer" }}
          >×</button>
        </div>
      )}

      {!activeRepo ? (
        <EmptyState onAddRepo={handleAddRepo} />
      ) : (
        <div style={body}>
          <Sidebar
            branches={branches}
            tags={tags}
            stashes={stashes}
            onCheckout={handleCheckout}
            onDeleteBranch={handleDeleteBranch}
            onStashPop={handleStashPop}
          />

          <CommitGraph
            rows={log}
            selectedOid={selectedOid}
            status={status}
            loading={loading}
            onSelectCommit={selectCommit}
            onSelectWip={selectWip}
            onCreateBranch={handleCreateBranch}
          />

          {rightPanel?.kind === "commit" && commitDetail && (
            <CommitDetailPanel
              detail={commitDetail}
              onClose={() => setRightPanel(null)}
            />
          )}
          {rightPanel?.kind === "wip" && (
            <WorkingDir
              status={status}
              onStage={handleStageFile}
              onUnstage={handleUnstageFile}
              onStageAll={handleStageAll}
              onCommit={handleCommit}
              onStash={handleStashPush}
              onClose={() => setRightPanel(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAddRepo }: { onAddRepo: (p: string) => void }) {
  const [inputVal, setInputVal] = useState("");
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      color: "var(--text-secondary)",
    }}>
      <div style={{ fontSize: 48 }}>⎇</div>
      <div style={{ fontSize: 18, color: "var(--text-primary)", fontWeight: 600 }}>
        No repositories open
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Paste the path to a local git repository to get started
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputVal.trim()) {
              onAddRepo(inputVal.trim());
              setInputVal("");
            }
          }}
          placeholder="C:\ruta\al\repositorio"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text-primary)",
            padding: "8px 12px",
            width: 360,
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          onClick={() => {
            if (inputVal.trim()) {
              onAddRepo(inputVal.trim());
              setInputVal("");
            }
          }}
          style={{
            background: "var(--accent)",
            border: "none",
            borderRadius: "var(--radius)",
            color: "#fff",
            padding: "8px 16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
}

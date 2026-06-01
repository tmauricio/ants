use serde::Serialize;

pub const LANE_COLORS: &[&str] = &[
    "#5cb6f8", // blue
    "#f9c74f", // yellow
    "#90be6d", // green
    "#f8961e", // orange
    "#c77dff", // purple
    "#43aa8b", // teal
    "#f94144", // red
    "#ff9f1c", // amber
    "#4cc9f0", // cyan
    "#f72585", // pink
];

#[derive(Debug, Serialize, Clone)]
pub struct GraphRow {
    pub oid: String,
    pub short_oid: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub is_merge: bool,
    pub lane: usize,
    pub color: String,
    pub num_lanes: usize,
    /// Edges going DOWN from this row to the next.
    /// Each edge: [from_lane, to_lane, color_index]
    pub edges: Vec<[usize; 3]>,
    pub refs: Vec<String>,
}

pub struct CommitInput {
    pub oid: String,
    pub short_oid: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub parents: Vec<String>,
    pub refs: Vec<String>,
}

/// Assigns lanes and computes edge data for a list of commits.
/// Commits must be in reverse-chronological (newest-first) order.
pub fn layout(commits: Vec<CommitInput>) -> Vec<GraphRow> {
    // open_lanes[i] = Some((parent_oid, color_idx)) or None
    let mut open: Vec<Option<(String, usize)>> = Vec::new();
    let mut color_counter: usize = 0;
    let mut rows: Vec<GraphRow> = Vec::with_capacity(commits.len());

    for commit in commits {
        let is_merge = commit.parents.len() > 1;

        // Find if this commit is already tracked in a lane
        let existing_lane = open.iter().position(|slot| {
            slot.as_ref().map(|(oid, _)| oid == &commit.oid).unwrap_or(false)
        });

        let (commit_lane, commit_color) = if let Some(lane) = existing_lane {
            let color = open[lane].as_ref().unwrap().1;
            (lane, color)
        } else {
            // New branch head – find a free lane or append one
            let lane = open
                .iter()
                .position(|s| s.is_none())
                .unwrap_or_else(|| {
                    open.push(None);
                    open.len() - 1
                });
            let color = color_counter % LANE_COLORS.len();
            color_counter += 1;
            (lane, color)
        };

        // Free this commit's slot
        open[commit_lane] = None;

        // Assign lanes to parents
        let mut parent_lanes: Vec<(usize, usize)> = Vec::new(); // (lane, color)

        for (i, parent_oid) in commit.parents.iter().enumerate() {
            // Check if this parent is already being tracked
            let already = open.iter().position(|s| {
                s.as_ref().map(|(o, _)| o == parent_oid).unwrap_or(false)
            });

            if let Some(lane) = already {
                let color = open[lane].as_ref().unwrap().1;
                parent_lanes.push((lane, color));
            } else {
                let lane = if i == 0 {
                    // First parent inherits the commit's lane
                    commit_lane
                } else {
                    // Additional parents get a new lane
                    open.iter()
                        .position(|s| s.is_none())
                        .unwrap_or_else(|| {
                            open.push(None);
                            open.len() - 1
                        })
                };
                let color = if i == 0 {
                    commit_color
                } else {
                    let c = color_counter % LANE_COLORS.len();
                    color_counter += 1;
                    c
                };
                open[lane] = Some((parent_oid.clone(), color));
                parent_lanes.push((lane, color));
            }
        }

        // Build outgoing edges:
        // 1. From commit lane to each parent lane
        let mut edges: Vec<[usize; 3]> = parent_lanes
            .iter()
            .map(|(to, color)| [commit_lane, *to, *color])
            .collect();

        // 2. Pass-through edges for all other open lanes
        for (i, slot) in open.iter().enumerate() {
            if let Some((_, c)) = slot {
                if !edges.iter().any(|e| e[0] == i) && i != commit_lane {
                    edges.push([i, i, *c]);
                }
            }
        }

        let num_lanes = open
            .iter()
            .enumerate()
            .filter_map(|(i, s)| if s.is_some() { Some(i + 1) } else { None })
            .max()
            .unwrap_or(0)
            .max(commit_lane + 1);

        rows.push(GraphRow {
            oid: commit.oid,
            short_oid: commit.short_oid,
            summary: commit.summary,
            author_name: commit.author_name,
            author_email: commit.author_email,
            author_time: commit.author_time,
            is_merge,
            lane: commit_lane,
            color: LANE_COLORS[commit_color].to_string(),
            num_lanes,
            edges,
            refs: commit.refs,
        });
    }

    rows
}

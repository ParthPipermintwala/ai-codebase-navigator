import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CircleDot,
  FileCode2,
  FolderTree,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { getRepositoryMap } from "@/services/api";
import { getRepoId } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";

interface MapNode {
  name: string;
  children?: MapNode[];
}

type GraphNodeData = {
  label: string;
  kind: "folder" | "file";
  depth: number;
  childCount: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
};

type GraphTreeOutput = {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
};

const NODE_WIDTH = 168;
const HORIZONTAL_GAP = 72;
const LEVEL_GAP = 132;

const RepoMapNode = ({ data }: NodeProps<GraphNodeData>) => {
  const folder = data.kind === "folder";

  return (
    <>
      <Handle id="in" type="target" position={Position.Top} className="opacity-0" />
      <div
        className="relative rounded-xl border px-2.5 py-2 shadow-sm transition-all duration-200"
        style={{
          borderColor: data.isSelected
            ? "hsl(var(--primary))"
            : folder
              ? "hsl(210 95% 65% / 0.45)"
              : "hsl(var(--border))",
          background: data.isSelected
            ? "linear-gradient(135deg, hsl(var(--primary) / 0.28), hsl(var(--primary) / 0.14))"
            : folder
              ? "linear-gradient(160deg, hsl(210 100% 65% / 0.2), hsl(210 90% 35% / 0.22))"
              : "linear-gradient(160deg, hsl(var(--muted) / 0.55), hsl(var(--card) / 0.9))",
          opacity: data.isDimmed ? 0.24 : 1,
          boxShadow: data.isSelected
            ? "0 0 0 1px hsl(var(--primary) / 0.25), 0 16px 35px -22px hsl(var(--primary) / 0.9)"
            : data.isHighlighted
              ? "0 8px 24px -18px hsl(var(--primary) / 0.75)"
              : "none",
          minWidth: NODE_WIDTH,
        }}
        title={data.label}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/70">
            {folder ? (
              <FolderTree className="h-3.5 w-3.5 text-blue-400" />
            ) : (
              <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/65 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <CircleDot className="h-2.5 w-2.5" />
            L{data.depth}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] font-semibold text-foreground line-clamp-2 break-all">{data.label}</p>
        <div className="mt-1.5 inline-flex items-center rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
          {folder ? `${data.childCount} children` : "File"}
        </div>
      </div>
      {Array.from({ length: Math.max(0, data.childCount) }).map((_, index) => {
        const left = `${((index + 1) / (data.childCount + 1)) * 100}%`;
        return (
          <Handle
            key={`out-${index}`}
            id={`out-${index}`}
            type="source"
            position={Position.Bottom}
            className="opacity-0"
            style={{ left }}
          />
        );
      })}
    </>
  );
};

const nodeTypes: NodeTypes = {
  repoNode: RepoMapNode,
};

const convertTreeToGraph = (root: MapNode | null): GraphTreeOutput => {
  if (!root) {
    return { nodes: [], edges: [] };
  }

  const nodes: Node<GraphNodeData>[] = [];
  const edges: Edge[] = [];
  let leafCursor = 0;

  const walk = (
    node: MapNode,
    depth: number,
    parentId: string | null,
    path: string,
    sourceHandleIndex: number | null,
  ): number => {
    const currentId = path;
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;

    let x = 0;
    if (hasChildren) {
      const childXPositions: number[] = [];
      node.children?.forEach((child, index) => {
        const childPath = `${currentId}/${child.name}`;
        const childX = walk(child, depth + 1, currentId, childPath, index);
        childXPositions.push(childX);
      });

      x =
        childXPositions.length > 1
          ? (childXPositions[0] + childXPositions[childXPositions.length - 1]) / 2
          : childXPositions[0] ?? 0;
    } else {
      x = leafCursor * (NODE_WIDTH + HORIZONTAL_GAP);
      leafCursor += 1;
    }

    const y = depth * LEVEL_GAP;

    nodes.push({
      id: currentId,
      type: "repoNode",
      data: {
        label: node.name,
        kind: hasChildren ? "folder" : "file",
        depth,
        childCount: node.children?.length || 0,
      },
      position: { x, y },
      draggable: false,
    });

    if (parentId) {
      edges.push({
        id: `${parentId}->${currentId}`,
        source: parentId,
        target: currentId,
        sourceHandle:
          sourceHandleIndex !== null ? `out-${sourceHandleIndex}` : undefined,
        targetHandle: "in",
        type: "bezier",
      });
    }

    return x;
  };

  walk(root, 0, null, root.name || "root", null);
  return { nodes, edges };
};

const collectDescendants = (edges: Edge[], selectedNodeId: string) => {
  const descendants = new Set<string>();
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const current = adjacency.get(edge.source) || [];
    current.push(edge.target);
    adjacency.set(edge.source, current);
  });

  const stack = [selectedNodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (descendants.has(current)) {
      continue;
    }

    descendants.add(current);
    const nextChildren = adjacency.get(current) || [];
    nextChildren.forEach((childId) => stack.push(childId));
  }

  return descendants;
};

const RepoMap = () => {
  const navigate = useNavigate();
  const [tree, setTree] = useState<MapNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const loadMap = async () => {
      const repoId = getRepoId();

      if (!repoId) {
        setError("No repository selected. Analyze a repository first.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const map = await getRepositoryMap(repoId);
        setTree(map || null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch repository map";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadMap();
  }, []);

  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => convertTreeToGraph(tree),
    [tree],
  );

  const highlightedIds = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    return collectDescendants(baseEdges, selectedNodeId);
  }, [baseEdges, selectedNodeId]);

  const nodes = useMemo(() => {
    return baseNodes.map((node) => {
      const isFolder = node.data.kind === "folder";
      const isSelected = node.id === selectedNodeId;
      const isHighlighted = highlightedIds ? highlightedIds.has(node.id) : true;
      const isDimmed = highlightedIds ? !highlightedIds.has(node.id) : false;

      return {
        ...node,
        data: {
          ...node.data,
          isSelected,
          isHighlighted,
          isDimmed,
        },
        style: {
          border: "none",
          background: "transparent",
          padding: 0,
          width: NODE_WIDTH,
          opacity: isDimmed ? 0.35 : 1,
          transition: "all 180ms ease",
        },
      };
    });
  }, [baseNodes, highlightedIds, selectedNodeId]);

  const edges = useMemo(() => {
    return baseEdges.map((edge) => {
      const selected = Boolean(selectedNodeId);
      const inHighlight =
        selected && highlightedIds
          ? highlightedIds.has(edge.source) && highlightedIds.has(edge.target)
          : true;

      return {
        ...edge,
        animated: inHighlight && selected,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: inHighlight ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.42)",
        },
        style: {
          stroke: inHighlight ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)",
          strokeWidth: inHighlight ? 1.9 : 1.1,
          opacity: inHighlight ? 0.9 : 0.25,
          filter: inHighlight ? "drop-shadow(0 0 4px hsl(var(--primary) / 0.35))" : "none",
          transition: "all 180ms ease",
        },
      };
    });
  }, [baseEdges, highlightedIds, selectedNodeId]);

  const onNodeClick: NodeMouseHandler = (_, node) => {
    setSelectedNodeId((current) => (current === node.id ? null : String(node.id)));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Repository Map"
        description="Folder and file hierarchy for your analyzed repository"
      >
        <Button variant="outline" onClick={() => navigate("/analyze")}>
          Analyze Another Repo
        </Button>
      </PageHeader>

      {loading && (
        <div className="glass rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Building repository map...</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass rounded-lg p-4 flex items-center gap-2 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {!loading && !error && (!tree || !tree.children || tree.children.length === 0) && (
        <div className="glass rounded-lg p-6 text-sm text-muted-foreground">
          No files were found for this repository map.
        </div>
      )}

      {!loading && !error && tree && tree.children && tree.children.length > 0 && (
        <div className="glass rounded-xl border border-border/60 p-3 h-[72vh] min-h-[520px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{ type: "bezier", style: { strokeLinecap: "round" } }}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            minZoom={0.25}
            maxZoom={1.8}
            nodesConnectable={false}
            nodesDraggable={false}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
          >
            <Background color="hsl(var(--muted-foreground) / 0.12)" gap={20} />
            <MiniMap
              zoomable
              pannable
              className="!bg-card !border !border-border"
              nodeColor={(node) =>
                node.data.kind === "folder"
                  ? "hsl(210 90% 60% / 0.85)"
                  : "hsl(var(--muted-foreground) / 0.7)"
              }
            />
            <Controls showInteractive={false} />
            <Panel position="top-left">
              <div className="rounded-xl border border-border/70 bg-card/85 px-3 py-2 backdrop-blur-sm shadow-sm">
                <p className="text-xs font-medium text-foreground">Repository Graph</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {nodes.length} nodes • {edges.length} links
                </p>
              </div>
            </Panel>
          </ReactFlow>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <FolderTree className="h-3.5 w-3.5 text-blue-400" />
              Folder node
            </div>
            <div className="inline-flex items-center gap-1.5">
              <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
              File node
            </div>
            <span>Click a node to focus its subtree, click canvas to reset.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoMap;

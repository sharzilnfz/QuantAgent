# codebase-memory-mcp Rules

This project uses `codebase-memory-mcp` as the primary code intelligence and index provider.

## MANDATORY PRE-FLIGHT GATE
1. **Always query codebase-memory-mcp first** before any raw grep, glob, or recursive file search.
2. Use the following tools when resolving structural queries:
   - `search_code`: Graph-augmented code search.
   - `search_graph`: Find nodes by name regex, labels, degrees, files.
   - `trace_path`: Trace incoming/outgoing call chains.
   - `get_code_snippet`: Read specific function/class source code.
   - `query_graph`: Execute Cypher queries for custom graph traversals.
   - `get_architecture`: Get high-level summary of languages, routes, hotspots.
   - `detect_changes`: Map local uncommitted changes to affected symbols.
3. **Subagent Delegation:** For any non-trivial multi-file feature or issue implementation, invoke subagents via `invoke_subagent` to divide research, test writing, and implementation.


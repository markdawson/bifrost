import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetMCPClientsQuery } from "@/lib/store";
import { MCPClient } from "@/lib/types/mcp";
import { VirtualMCPToolSpec } from "@/lib/types/virtualMcps";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

// WhiteList wildcard token: ["*"] = all tools, [] = none (deny-by-default), a named list = specific.
const TOOL_WILDCARD = "*";

interface VirtualMCPToolsTabProps {
	value: VirtualMCPToolSpec[];
	onChange: (specs: VirtualMCPToolSpec[]) => void;
	active: boolean;
}

export default function VirtualMCPToolsTab({ value, onChange, active }: VirtualMCPToolsTabProps) {
	const { data, isLoading, isError } = useGetMCPClientsQuery({ limit: 1000 }, { skip: !active });
	const clients = useMemo(() => data?.clients ?? [], [data]);
	const clientById = useMemo(() => new Map(clients.map((c) => [c.config.client_id, c])), [clients]);

	const usedIds = new Set(value.map((s) => s.mcp_client_id));
	const addable = clients.filter((c) => !usedIds.has(c.config.client_id));

	// New servers default to all tools (the MCP client sheet defaults tools_to_execute to ["*"] too).
	const addClient = (clientId: string) => onChange([...value, { mcp_client_id: clientId, tool_names: [TOOL_WILDCARD] }]);
	const removeSpec = (clientId: string) => onChange(value.filter((s) => s.mcp_client_id !== clientId));
	const setToolNames = (clientId: string, toolNames: string[]) =>
		onChange(value.map((s) => (s.mcp_client_id === clientId ? { ...s, tool_names: toolNames } : s)));

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-10">
				<Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="text-destructive rounded-md border border-dashed p-6 text-center text-sm">
				Could not load MCP servers. Try again; selected servers cannot be verified until this loads.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex flex-col gap-0.5">
					<Label>Tools</Label>
					<p className="text-muted-foreground text-xs">Pick which of your MCP servers' tools this Virtual MCP exposes.</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" disabled={addable.length === 0} data-testid="virtual-mcp-add-server-btn">
							<Plus className="h-4 w-4" />
							Add server
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
						{addable.map((c) => (
							<DropdownMenuItem key={c.config.client_id} className="cursor-pointer gap-2" onSelect={() => addClient(c.config.client_id)}>
								<span className="truncate">{c.config.name}</span>
								<HealthBadge client={c} />
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{value.length === 0 ? (
				<div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
					No servers added yet. Add a server to expose its tools through this Virtual MCP.
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{value.map((spec) => (
						<ToolSpecCard
							key={spec.mcp_client_id}
							spec={spec}
							client={clientById.get(spec.mcp_client_id)}
							onToolNamesChange={(names) => setToolNames(spec.mcp_client_id, names)}
							onRemove={() => removeSpec(spec.mcp_client_id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface ToolSpecCardProps {
	spec: VirtualMCPToolSpec;
	client?: MCPClient;
	onToolNamesChange: (names: string[]) => void;
	onRemove: () => void;
}

function ToolSpecCard({ spec, client, onToolNamesChange, onRemove }: ToolSpecCardProps) {
	const [open, setOpen] = useState(false);

	const liveTools = client?.tools ?? [];
	const liveNames = liveTools.map((t) => t.name);
	// WhiteList semantics: ["*"] = all tools (incl. future), [] = none (deny-by-default), list = specific.
	const allTools = spec.tool_names.length === 1 && spec.tool_names[0] === TOOL_WILDCARD;
	const specificNames = allTools ? [] : spec.tool_names;
	const included = (name: string) => allTools || specificNames.includes(name);

	// Pinned tools no longer offered by the live client: kept but flagged, so nothing silently disappears.
	const pinnedMissing = specificNames.filter((n) => !liveNames.includes(n));
	const rows = [
		...liveTools.map((t) => ({ name: t.name, description: t.description, disabledAtSource: false })),
		...pinnedMissing.map((n) => ({ name: n, description: undefined as string | undefined, disabledAtSource: true })),
	];
	const includedCount = allTools ? liveTools.length : specificNames.length;

	// All tools on -> ["*"]; off -> [] (deny-by-default, every individual tool off).
	const setAllTools = (all: boolean) => onToolNamesChange(all ? [TOOL_WILDCARD] : []);
	const toggleTool = (name: string, on: boolean) => {
		// Turning a tool off while on "all" expands the wildcard to the current tools minus that one.
		const base = new Set(allTools ? liveNames : specificNames);
		if (on) base.add(name);
		else base.delete(name);
		onToolNamesChange([...base]);
	};

	return (
		<div className="rounded-md border">
			<div className="flex items-center justify-between gap-2 border-b p-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="truncate text-sm font-medium">{client?.config.name ?? spec.mcp_client_id}</span>
					<HealthBadge client={client} />
				</div>
				<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove server" onClick={onRemove}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{!client ? (
				<p className="text-muted-foreground p-3 text-xs">
					This server no longer exists. {spec.tool_names.length > 0 ? `Pinned tools: ${spec.tool_names.join(", ")}.` : ""} Remove it to
					clean up the selection.
				</p>
			) : (
				<>
					<div className="flex items-center justify-between gap-2 p-3">
						<div className="flex flex-col gap-0.5">
							<Label htmlFor={`vmcp-alltools-${spec.mcp_client_id}`} className="text-sm">
								All tools
							</Label>
							<p className="text-muted-foreground text-xs">Include every tool this server exposes, now and in the future.</p>
						</div>
						<Switch
							id={`vmcp-alltools-${spec.mcp_client_id}`}
							checked={allTools}
							onCheckedChange={setAllTools}
							data-testid={`virtual-mcp-alltools-${spec.mcp_client_id}`}
						/>
					</div>

					<Collapsible open={open} onOpenChange={setOpen}>
						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="hover:bg-muted/50 flex w-full items-center justify-between gap-2 border-t px-3 py-2.5 text-sm transition-colors"
								data-testid={`virtual-mcp-tools-accordion-${spec.mcp_client_id}`}
							>
								<span>Individual tools</span>
								<span className="text-muted-foreground flex items-center gap-2 text-xs">
									{includedCount} of {rows.length} included
									<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
								</span>
							</button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							{rows.length === 0 ? (
								<p className="text-muted-foreground border-t p-3 text-xs">This server is not currently exposing any tools.</p>
							) : (
								<div className="border-t">
									<Table className="table-fixed">
										<TableHeader>
											<TableRow>
												<TableHead>Tool name</TableHead>
												<TableHead className="w-24 text-right">Included</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{rows.map((row) => (
												<TableRow key={row.name}>
													<TableCell className="align-top whitespace-normal">
														<div className="flex flex-col gap-0.5">
															<div className="flex flex-wrap items-center gap-2">
																<span className="font-mono text-sm break-all">{row.name}</span>
																{row.disabledAtSource && <span className="text-xs text-amber-600 dark:text-amber-500">disabled at source</span>}
															</div>
															{row.description && <span className="text-muted-foreground text-xs break-words">{row.description}</span>}
														</div>
													</TableCell>
													<TableCell className="w-24 align-top text-right">
														<Switch
															checked={included(row.name)}
															onCheckedChange={(on) => toggleTool(row.name, on)}
															aria-label={`Include ${row.name}`}
															data-testid={`virtual-mcp-tool-${spec.mcp_client_id}-${row.name}`}
														/>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</CollapsibleContent>
					</Collapsible>
				</>
			)}
		</div>
	);
}

function HealthBadge({ client }: { client?: MCPClient }) {
	if (!client) return <Badge variant="destructive">Unavailable</Badge>;
	if (client.config.disabled || client.state === "disabled") return <Badge variant="secondary">Disabled</Badge>;
	if (client.state === "healthy") return <Badge>Healthy</Badge>;
	if (client.state === "error" || client.state === "needs_reauth") return <Badge variant="destructive">{client.state}</Badge>;
	return (
		<Badge variant="outline" className="border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
			{client.state}
		</Badge>
	);
}

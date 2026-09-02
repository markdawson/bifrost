import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { Label } from "@/components/ui/label";
import { useGetVirtualKeysQuery } from "@/lib/store";
import VirtualMcpAccessProfiles from "@enterprise/components/virtual-mcps/virtualMcpAccessProfiles";
import { KeyRound, Plus, X } from "lucide-react";

interface VirtualMCPAccessTabProps {
	vmcpId: number;
	// Staged assigned VK ids; committed on Save (mirrors the MCP sheet's vk_configs staging).
	value: string[];
	onChange: (ids: string[]) => void;
	isCreate: boolean;
	active: boolean;
}

export default function VirtualMCPAccessTab({ vmcpId, value, onChange, isCreate, active }: VirtualMCPAccessTabProps) {
	// Access-profile-managed keys derive their MCP access from their profile, so they cannot be assigned
	// directly here (the API rejects them too).
	const { data, isLoading, isError } = useGetVirtualKeysQuery(
		{ limit: 1000, exclude_access_profile_managed_virtual: true },
		{ skip: !active || isCreate },
	);

	if (isCreate) {
		return (
			<div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
				Create this Virtual MCP first, then assign it to virtual keys here.
			</div>
		);
	}

	if (isError) {
		return (
			<div className="text-destructive rounded-md border border-dashed p-6 text-center text-sm">
				Could not load virtual keys. Try again.
			</div>
		);
	}

	const vks = data?.virtual_keys ?? [];
	const vkById = new Map(vks.map((v) => [v.id, v]));
	const assignedSet = new Set(value);
	const assignable = vks.filter((v) => !assignedSet.has(v.id) && !v.is_access_profile_managed);

	const addVk = (vkId: string) => onChange([...value, vkId]);
	const removeVk = (vkId: string) => onChange(value.filter((id) => id !== vkId));

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex flex-col gap-0.5">
					<Label>Virtual keys</Label>
					<p className="text-muted-foreground text-xs">Keys assigned here can reach this Virtual MCP at its endpoint.</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" disabled={isLoading || assignable.length === 0} data-testid="virtual-mcp-assign-vk-btn">
							<Plus className="h-4 w-4" />
							Assign virtual key
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
						{assignable.map((vk) => (
							<DropdownMenuItem key={vk.id} className="cursor-pointer" onSelect={() => addVk(vk.id)}>
								<span className="truncate">{vk.name}</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{isLoading ? (
				<div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">Loading virtual keys…</div>
			) : value.length === 0 ? (
				<div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
					No virtual keys assigned yet. Assign one so callers can reach this Virtual MCP.
				</div>
			) : (
				<div className="overflow-hidden rounded-md border">
					{value.map((vkId) => {
						const vk = vkById.get(vkId);
						return (
							<div key={vkId} className="flex items-center justify-between gap-2 border-b p-3 last:border-b-0">
								<div className="flex min-w-0 items-center gap-2">
									<KeyRound className="text-muted-foreground size-4 shrink-0" />
									<span className="truncate text-sm">{vk?.name ?? vkId}</span>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0"
									aria-label="Unassign virtual key"
									onClick={() => removeVk(vkId)}
									data-testid={`virtual-mcp-detach-vk-${vkId}`}
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						);
					})}
				</div>
			)}

			<VirtualMcpAccessProfiles vmcpId={vmcpId} active={active} />
		</div>
	);
}

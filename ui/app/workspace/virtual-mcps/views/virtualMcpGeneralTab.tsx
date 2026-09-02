import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface VirtualMCPGeneralTabProps {
	name: string;
	setName: (value: string) => void;
	endpointSlug: string;
	setEndpointSlug: (value: string) => void;
	description: string;
	setDescription: (value: string) => void;
	enabled: boolean;
	setEnabled: (value: boolean) => void;
	isCreate: boolean;
}

export default function VirtualMCPGeneralTab({
	name,
	setName,
	endpointSlug,
	setEndpointSlug,
	description,
	setDescription,
	enabled,
	setEnabled,
	isCreate,
}: VirtualMCPGeneralTabProps) {
	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<Label htmlFor="vmcp-name">Name</Label>
				<Input
					id="vmcp-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Machine Learning Team"
					data-testid="virtual-mcp-name-input"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="vmcp-slug">Endpoint slug</Label>
				<Input
					id="vmcp-slug"
					value={endpointSlug}
					onChange={(e) => setEndpointSlug(e.target.value)}
					placeholder="Leave blank to derive from the name"
					disabled={!isCreate}
					className="font-mono"
					data-testid="virtual-mcp-slug-input"
				/>
				<p className="text-muted-foreground text-xs">
					{isCreate
						? "The URL-safe path this Virtual MCP is served at. Immutable after creation."
						: "The endpoint slug cannot be changed after creation."}
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="vmcp-description">Description</Label>
				<Textarea
					id="vmcp-description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="What this Virtual MCP is for (optional)"
					rows={3}
					data-testid="virtual-mcp-description-input"
				/>
			</div>

			<div className="flex items-center justify-between rounded-md border p-3">
				<div className="flex flex-col gap-0.5">
					<Label htmlFor="vmcp-enabled">Enabled</Label>
					<p className="text-muted-foreground text-xs">When disabled, the endpoint stops serving and is not resolved for any key.</p>
				</div>
				<Switch id="vmcp-enabled" checked={enabled} onCheckedChange={setEnabled} data-testid="virtual-mcp-enabled-switch" />
			</div>
		</div>
	);
}

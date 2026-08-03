import { isIP } from "node:net";

export interface ConnectorConfig {
	name: string;
	slot: number;
	projectId: string;
	environmentId: string;
	region?: string;
	realPrefix?: string;
}

export interface TemplateConfig {
	edgeId: string;
	virtualNetwork: string;
	region: string;
	size: string;
	sshSourceCidrs: string[];
	connectors: ConnectorConfig[];
}

export type SSTHome = "cloudflare" | "local";

type Environment = Record<string, string | undefined>;

const namePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function parseHome(value: string | undefined): SSTHome {
	const home = value?.trim() || "cloudflare";
	if (home !== "cloudflare" && home !== "local") {
		throw new Error("SST_HOME must be cloudflare or local.");
	}
	return home;
}

export function parseConfig(
	environment: Environment = process.env,
): TemplateConfig {
	const connectors = parseConnectors(
		required(environment, "TAILBRIDGE_CONNECTORS_JSON"),
	);
	const virtualNetwork = optional(
		environment,
		"TAILBRIDGE_VIRTUAL_NETWORK",
		"fd20::/11",
	);
	if (!validIpv6Network(virtualNetwork)) {
		throw new Error("TAILBRIDGE_VIRTUAL_NETWORK must be an IPv6 /11 network.");
	}
	return {
		edgeId: validName(
			"TAILBRIDGE_EDGE_ID",
			optional(environment, "TAILBRIDGE_EDGE_ID", "production"),
		),
		virtualNetwork,
		region: optional(environment, "DIGITALOCEAN_REGION", "nyc3"),
		size: optional(environment, "DIGITALOCEAN_SIZE", "s-1vcpu-1gb"),
		sshSourceCidrs: parseCidrs(
			"EDGE_SSH_SOURCE_CIDRS",
			required(environment, "EDGE_SSH_SOURCE_CIDRS"),
		),
		connectors,
	};
}

function parseConnectors(value: string): ConnectorConfig[] {
	let input: unknown;
	try {
		input = JSON.parse(value);
	} catch {
		throw new Error("TAILBRIDGE_CONNECTORS_JSON must contain valid JSON.");
	}
	if (!Array.isArray(input) || input.length === 0) {
		throw new Error("TAILBRIDGE_CONNECTORS_JSON must contain a nonempty array.");
	}

	const connectors = input.map((entry, index) => parseConnector(entry, index));
	const names = connectors.map((connector) => connector.name);
	const slots = connectors.map((connector) => connector.slot);
	if (new Set(names).size !== names.length) {
		throw new Error("TAILBRIDGE_CONNECTORS_JSON names must be unique.");
	}
	if (new Set(slots).size !== slots.length) {
		throw new Error("TAILBRIDGE_CONNECTORS_JSON slots must be unique.");
	}
	return connectors;
}

function parseConnector(value: unknown, index: number): ConnectorConfig {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`TAILBRIDGE_CONNECTORS_JSON[${index}] must be an object.`);
	}
	const entry = value as Record<string, unknown>;
	const name = validName(
		`TAILBRIDGE_CONNECTORS_JSON[${index}].name`,
		requiredString(entry, "name", index),
	);
	if (!Number.isInteger(entry.slot) || Number(entry.slot) < 0 || Number(entry.slot) > 31) {
		throw new Error(`TAILBRIDGE_CONNECTORS_JSON[${index}].slot must be an integer from 0 through 31.`);
	}
	const projectId = optionalString(entry, "projectId", index);
	const environmentId = optionalString(entry, "environmentId", index);
	if (!projectId || !environmentId) {
		throw new Error(
			`TAILBRIDGE_CONNECTORS_JSON[${index}] must set projectId and environmentId.`,
		);
	}
	return {
		name,
		slot: Number(entry.slot),
		projectId,
		environmentId,
		region: optionalString(entry, "region", index),
		realPrefix: optionalString(entry, "realPrefix", index),
	};
}

function required(environment: Environment, name: string): string {
	const value = environment[name]?.trim();
	if (!value) {
		throw new Error(`${name} must be set.`);
	}
	return value;
}

function optional(
	environment: Environment,
	name: string,
	fallback: string,
): string {
	return environment[name]?.trim() || fallback;
}

function requiredString(
	entry: Record<string, unknown>,
	name: string,
	index: number,
): string {
	const value = optionalString(entry, name, index);
	if (!value) {
		throw new Error(`TAILBRIDGE_CONNECTORS_JSON[${index}].${name} must be set.`);
	}
	return value;
}

function optionalString(
	entry: Record<string, unknown>,
	name: string,
	index: number,
): string | undefined {
	const value = entry[name];
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`TAILBRIDGE_CONNECTORS_JSON[${index}].${name} must be a nonempty string.`);
	}
	return value.trim();
}

function validName(label: string, value: string): string {
	if (!namePattern.test(value)) {
		throw new Error(`${label} must match ${namePattern.source}.`);
	}
	return value;
}

function parseCidrs(label: string, value: string): string[] {
	const cidrs = value.split(",").map((cidr) => cidr.trim());
	if (cidrs.some((cidr) => !validCidr(cidr))) {
		throw new Error(`${label} must contain a comma-separated list of CIDRs.`);
	}
	return cidrs;
}

function validCidr(value: string): boolean {
	const [address, prefix, extra] = value.split("/");
	const version = isIP(address);
	if (extra !== undefined || version === 0 || !/^\d+$/.test(prefix ?? "")) {
		return false;
	}
	const length = Number(prefix);
	return length >= 0 && length <= (version === 4 ? 32 : 128);
}

function validIpv6Network(value: string): boolean {
	const [address, prefix, extra] = value.split("/");
	return extra === undefined && prefix === "11" && isIP(address) === 6;
}

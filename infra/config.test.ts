import { describe, expect, it } from "vitest";

import { parseConfig, parseHome } from "./config";

const connector = JSON.stringify([
	{
		name: "production",
		slot: 0,
		projectId: "project-id",
		environmentId: "environment-id",
	},
]);

describe("parseHome", () => {
	it("uses Cloudflare by default", () => {
		expect(parseHome(undefined)).toBe("cloudflare");
	});

	it("supports local state", () => {
		expect(parseHome(" local ")).toBe("local");
	});

	it("rejects an unknown state home", () => {
		expect(() => parseHome("aws")).toThrow(
			"SST_HOME must be cloudflare or local.",
		);
	});
});

describe("parseConfig", () => {
	it("applies safe defaults", () => {
		expect(
			parseConfig({
				EDGE_SSH_SOURCE_CIDRS: "192.0.2.4/32",
				TAILBRIDGE_CONNECTORS_JSON: connector,
			}),
		).toEqual({
			edgeId: "production",
			virtualNetwork: "fd20::/11",
			region: "nyc3",
			size: "s-1vcpu-1gb",
			sshSourceCidrs: ["192.0.2.4/32"],
			connectors: [
				{
					name: "production",
					slot: 0,
					projectId: "project-id",
					environmentId: "environment-id",
					region: undefined,
					realPrefix: undefined,
				},
			],
		});
	});

	it("parses existing Railway resources", () => {
		const config = parseConfig({
			EDGE_SSH_SOURCE_CIDRS: "198.51.100.0/24",
			TAILBRIDGE_CONNECTORS_JSON: JSON.stringify([
				{
					name: "database",
					slot: 7,
					projectId: "project-id",
					environmentId: "environment-id",
					region: "us-west2",
					realPrefix: "fd12::/16",
				},
			]),
		});

		expect(config.connectors[0]).toMatchObject({
			name: "database",
			slot: 7,
			projectId: "project-id",
			environmentId: "environment-id",
		});
	});

	it.each([
		[{}, "TAILBRIDGE_CONNECTORS_JSON must be set."],
		[
			{ TAILBRIDGE_CONNECTORS_JSON: "not-json", EDGE_SSH_SOURCE_CIDRS: "192.0.2.4/32" },
			"TAILBRIDGE_CONNECTORS_JSON must contain valid JSON.",
		],
		[
			{ TAILBRIDGE_CONNECTORS_JSON: "[]", EDGE_SSH_SOURCE_CIDRS: "192.0.2.4/32" },
			"TAILBRIDGE_CONNECTORS_JSON must contain a nonempty array.",
		],
		[
			{
				TAILBRIDGE_CONNECTORS_JSON: JSON.stringify([{ name: "bad", slot: 32, projectId: "p", environmentId: "e" }]),
				EDGE_SSH_SOURCE_CIDRS: "192.0.2.4/32",
			},
			"slot must be an integer from 0 through 31",
		],
		[
			{
				TAILBRIDGE_CONNECTORS_JSON: JSON.stringify([
					{ name: "one", slot: 0, projectId: "p1", environmentId: "e1" },
					{ name: "two", slot: 0, projectId: "p2", environmentId: "e2" },
				]),
				EDGE_SSH_SOURCE_CIDRS: "192.0.2.4/32",
			},
			"TAILBRIDGE_CONNECTORS_JSON slots must be unique.",
		],
		[
			{
				TAILBRIDGE_CONNECTORS_JSON: connector,
				EDGE_SSH_SOURCE_CIDRS: "all",
			},
			"EDGE_SSH_SOURCE_CIDRS must contain a comma-separated list of CIDRs.",
		],
		[
			{
				TAILBRIDGE_CONNECTORS_JSON: connector,
				EDGE_SSH_SOURCE_CIDRS: "192.0.2.4/32",
				TAILBRIDGE_VIRTUAL_NETWORK: "fd20::/16",
			},
			"TAILBRIDGE_VIRTUAL_NETWORK must be an IPv6 /11 network.",
		],
	])("rejects invalid configuration %#", (environment, message) => {
		expect(() => parseConfig(environment)).toThrow(message);
	});
});

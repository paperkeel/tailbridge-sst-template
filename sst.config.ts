/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	async app() {
		const { parseHome } = await import("./infra/config");
		return {
			name: "tailbridge",
			home: parseHome(process.env.SST_HOME),
			removal: "remove",
		};
	},
	async run() {
		const [{ Tailbridge }, { parseConfig }] = await Promise.all([
			import("@bearfire-dev/tailscale-railway-quic-bridge"),
			import("./infra/config"),
		]);
		const config = parseConfig();
		const deployment = new Tailbridge("Tailbridge", {
			stage: $app.stage,
			edgeId: config.edgeId,
			virtualNetwork: config.virtualNetwork,
			edge: {
				provider: "digitalocean",
				region: config.region,
				size: config.size,
				sshSourceCidrs: config.sshSourceCidrs,
			},
			connectors: config.connectors,
			tailscaleAuthKey: new sst.Secret("TailscaleAuthKey").value,
		});

		return {
			artifactVersion: deployment.artifactVersion,
			edgeId: deployment.edgeId,
			edgeIpv4: deployment.edgeIpv4,
			edgeIpv6: deployment.edgeIpv6,
			connectorEndpoint: deployment.connectorEndpoint,
			connectors: deployment.connectors,
			tailscaleRoutes: deployment.tailscaleRoutes,
			tailscalePolicyFragment: deployment.tailscalePolicyFragment,
			edgeStatusCommand: deployment.edgeStatusCommand,
			edgeLogsCommand: deployment.edgeLogsCommand,
		};
	},
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const templateRoot = fileURLToPath(new URL("..", import.meta.url));

describe("template workflows", () => {
	it("uses the equivalent Blacksmith runner for every job", () => {
		for (const name of ["check.yml", "deploy.yml"]) {
			const workflow = readFileSync(
				`${templateRoot}/.github/workflows/${name}`,
				"utf8",
			);
			const runners = [
				...workflow.matchAll(/^\s+runs-on: (.+)$/gm),
			].map(([, runner]) => runner);
			expect(runners).toEqual(["blacksmith-2vcpu-ubuntu-2404"]);
		}
	});

	it("pins each third-party action to a commit", () => {
		for (const name of ["check.yml", "deploy.yml"]) {
			const workflow = readFileSync(
				`${templateRoot}/.github/workflows/${name}`,
				"utf8",
			);
			const actions = workflow.matchAll(/^\s*- uses: ([^\s]+)$/gm);
			for (const [, action] of actions) {
				expect(action).toMatch(/@[a-f0-9]{40}$/);
			}
		}
	});

	it("polls hourly and supports an exact rollback version", () => {
		const workflow = readFileSync(
			`${templateRoot}/.github/workflows/deploy.yml`,
			"utf8",
		);

		expect(workflow).toContain('cron: "17 * * * *"');
		expect(workflow).toContain("package_version:");
		expect(workflow).toContain("$package@master");
		expect(workflow).toContain("outputs.artifactVersion");
		expect(workflow).toContain('echo "cidr=$address/32"');
		expect(workflow).toContain(
			'printf \'%s\' "$TAILSCALE_AUTH_KEY" | pnpm sst secret set',
		);
	});
});

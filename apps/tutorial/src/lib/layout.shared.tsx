import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const gitConfig = {
  user: "adamhake",
  repo: "eigen",
  branch: "main",
  /** Where the MDX content lives, relative to the repository root. */
  contentDir: "apps/tutorial/src/content",
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "The Eigen Series",
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}

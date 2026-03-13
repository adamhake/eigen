import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

function shortenSidebarTitles(tree: ReturnType<typeof source.getPageTree>) {
  return {
    ...tree,
    children: tree.children.map((node) => {
      if (node.type === "page" && typeof node.name === "string") {
        return { ...node, name: node.name.replace(/\s*—\s*.+$/, "") };
      }
      return node;
    }),
  } as typeof tree;
}

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <DocsLayout tree={shortenSidebarTitles(source.getPageTree())} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}

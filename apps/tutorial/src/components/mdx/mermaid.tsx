import { renderMermaidSVG } from "beautiful-mermaid";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

export async function Mermaid({ chart }: { chart: string }) {
  let svg: string;
  try {
    svg = renderMermaidSVG(chart, {
      bg: "var(--color-fd-background)",
      fg: "var(--color-fd-foreground)",
      interactive: true,
      transparent: true,
    });
  } catch {
    return (
      <CodeBlock title="Mermaid">
        <Pre>{chart}</Pre>
      </CodeBlock>
    );
  }

  // SVG is generated server-side by a trusted library
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}

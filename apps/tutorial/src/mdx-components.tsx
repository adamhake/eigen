import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import * as diagrams from "@/components/diagrams";
import { Callout } from "@/components/mdx/callout";
import { TestSection } from "@/components/test-section";
import { TypeDeepDive } from "@/components/type-deep-dive";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout,
    Step,
    Steps,
    Tab,
    Tabs,
    File,
    Files,
    Folder,
    TestSection,
    TypeDeepDive,
    ...diagrams,
    ...components,
  };
}

import { Arrow, bottom, Box, Diagram, left, Region, right, top } from "./kit";

/* ------------------------------------------------------ layout persistence */

const rows = [48, 124, 200, 276];
const H = 56;
const colA = 30;
const colB = 446;
const W = 244;

const rowY = (i: number) => rows[i] + H / 2;

export function LayoutPersistenceDiagram() {
  return (
    <Diagram
      width={720}
      height={356}
      caption="Navigating from /dashboard/settings to /dashboard/analytics keeps the root and dashboard layouts mounted, because the same component types with the same keys sit at the same positions; only the subtree below them is replaced."
    >
      <Region x={4} y={8} w={296} h={340} label="/dashboard/settings" />
      <Region x={420} y={8} w={296} h={340} label="/dashboard/analytics" />

      <Box x={colA} y={rows[0]} w={W} h={H} label="RootLayout" sub="key '/'" tone="accent" />
      <Box x={colA} y={rows[1]} w={W} h={H} label="DashboardLayout" sub="key '/dashboard'" tone="accent" />
      <Box x={colA} y={rows[2]} w={W} h={H} label="SettingsPage" sub="unmounted" tone="muted" />

      <Box x={colB} y={rows[0]} w={W} h={H} label="RootLayout" sub="key '/'" tone="accent" />
      <Box x={colB} y={rows[1]} w={W} h={H} label="DashboardLayout" sub="key '/dashboard'" tone="accent" />
      <Box x={colB} y={rows[2]} w={W} h={H} label="AnalyticsLayout" sub="key '/dashboard/analytics'" />
      <Box x={colB} y={rows[3]} w={W} h={H} label="AnalyticsPage" sub="mounted" />

      {[0, 1].map((i) => (
        <Arrow
          key={`a${i}`}
          from={bottom({ x: colA, y: rows[i], w: W, h: H })}
          to={top({ x: colA, y: rows[i + 1], w: W, h: H })}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <Arrow
          key={`b${i}`}
          from={bottom({ x: colB, y: rows[i], w: W, h: H })}
          to={top({ x: colB, y: rows[i + 1], w: W, h: H })}
        />
      ))}

      <Arrow from={[colA + W, rowY(0)]} to={[colB, rowY(0)]} label="kept" tone="accent" />
      <Arrow from={[colA + W, rowY(1)]} to={[colB, rowY(1)]} label="kept" tone="accent" />
      <Arrow from={[colA + W, rowY(2)]} to={[colB, rowY(2)]} label="replaced" dashed />
    </Diagram>
  );
}

/* ------------------------------------------------------- parallel loaders */

const start = { x: 4, y: 112, w: 150, h: 56 };
const loaders = [
  { x: 194, y: 24, w: 176, h: 56 },
  { x: 194, y: 112, w: 176, h: 56 },
  { x: 194, y: 200, w: 176, h: 56 },
];
const routeData = { x: 410, y: 112, w: 140, h: 56 };
const html = { x: 590, y: 60, w: 126, h: 56 };
const endpoint = { x: 590, y: 164, w: 126, h: 56 };

export function LayoutLoadersDiagram() {
  return (
    <Diagram
      width={720}
      height={272}
      caption="loadRouteData starts every layout loader and the page loader at once and collects the results into one RouteData record, which both the server-rendered HTML and the data endpoint serialize."
    >
      <Box {...start} label="loadRouteData()" sub="Promise.all" mono tone="accent" />

      <Box {...loaders[0]} label="layout '/'" sub="loader()" mono />
      <Box {...loaders[1]} label="layout '/dashboard'" sub="loader()" mono />
      <Box {...loaders[2]} label="page" sub="loader()" mono />

      <Box {...routeData} label="RouteData" sub="{ layouts, page }" mono tone="accent" />
      <Box {...html} label="__EIGEN_DATA__" sub="initial HTML" mono />
      <Box {...endpoint} label="/_eigen/data" sub="navigations" mono />

      <Arrow
        from={right(start)}
        via={[
          [174, 140],
          [174, 52],
        ]}
        to={left(loaders[0])}
      />
      <Arrow from={right(start)} to={left(loaders[1])} />
      <Arrow
        from={right(start)}
        via={[
          [174, 140],
          [174, 228],
        ]}
        to={left(loaders[2])}
      />

      <Arrow
        from={right(loaders[0])}
        via={[
          [390, 52],
          [390, 140],
        ]}
        to={left(routeData)}
      />
      <Arrow from={right(loaders[1])} to={left(routeData)} />
      <Arrow
        from={right(loaders[2])}
        via={[
          [390, 228],
          [390, 140],
        ]}
        to={left(routeData)}
      />

      <Arrow
        from={right(routeData)}
        via={[
          [570, 140],
          [570, 88],
        ]}
        to={left(html)}
      />
      <Arrow
        from={right(routeData)}
        via={[
          [570, 140],
          [570, 192],
        ]}
        to={left(endpoint)}
      />
    </Diagram>
  );
}

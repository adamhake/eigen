import { Arrow, Box, Diagram, left, Region, right } from "./kit";

const browser = { x: 16, y: 84, w: 150, h: 60 };
const http = { x: 236, y: 84, w: 170, h: 60 };
const vite = { x: 490, y: 20, w: 214, h: 76 };
const eigen = { x: 490, y: 128, w: 214, h: 76 };
const ELBOW = 450;

export function UpgradeRoutingDiagram() {
  return (
    <Diagram
      width={720}
      height={222}
      caption="Both WebSocket servers listen to the same 'upgrade' event and each claims only its own requests: Vite by base path and subprotocol, Eigen by path."
    >
      <Box {...browser} label="Browser" sub="two WebSockets" />
      <Box {...http} label="http.Server" sub="'upgrade' event" mono />
      <Box {...vite} label="Vite HMR socket" sub={"base + 'vite-hmr'\ndev only"} tone="muted" />
      <Box {...eigen} label="attachRealtime()" sub={"path /_eigen/ws\ndev and production"} mono tone="accent" />

      <Arrow from={right(browser)} to={left(http)} label="Upgrade" />
      <Arrow
        from={right(http, -10)}
        via={[
          [ELBOW, http.y + http.h / 2 - 10],
          [ELBOW, vite.y + vite.h / 2],
        ]}
        to={left(vite)}
      />
      <Arrow
        from={right(http, 10)}
        via={[
          [ELBOW, http.y + http.h / 2 + 10],
          [ELBOW, eigen.y + eigen.h / 2],
        ]}
        to={left(eigen)}
        tone="accent"
      />
    </Diagram>
  );
}

const post = { x: 16, y: 44, w: 140, h: 60 };
const handler = { x: 16, y: 154, w: 140, h: 60 };
const dash = { x: 262, y: 44, w: 210, h: 60 };
const chat = { x: 262, y: 154, w: 210, h: 60 };
const TAB_X = 556;
const TAB_W = 148;
const tab = (y: number) => ({ x: TAB_X, y, w: TAB_W, h: 40 });
const tabs = [tab(28), tab(80), tab(138), tab(190)];
const FAN = 516;

export function RealtimeHubDiagram() {
  return (
    <Diagram
      width={720}
      height={250}
      caption="The hub maps each channel to its open sockets; a server function or a channel handler broadcasts to a channel, optionally excluding the sender."
    >
      <Region x={242} y={8} w={250} h={232} label="hub (globalThis)" tone="accent" />

      <Box {...post} label="createPost()" sub="server function" mono />
      <Box {...handler} label="chat.ts" sub="onMessage handler" mono />
      <Box {...dash} label="dashboard" sub="Set<WebSocket>" mono tone="accent" />
      <Box {...chat} label="chat" sub="Set<WebSocket>" mono tone="accent" />

      <Box {...tabs[0]} label="tab A" />
      <Box {...tabs[1]} label="tab B" />
      <Box {...tabs[2]} label="tab C" />
      <Box {...tabs[3]} label="tab D (sender)" tone="ghost" />

      <Arrow from={right(post)} to={left(dash)} label="broadcast()" mono />
      <Arrow from={right(handler)} to={left(chat)} label="broadcast()" mono />

      {[0, 1].map((i) => (
        <Arrow
          key={i}
          from={right(dash)}
          via={[
            [FAN, 74],
            [FAN, tabs[i].y + 20],
          ]}
          to={left(tabs[i])}
        />
      ))}
      <Arrow
        from={right(chat)}
        via={[
          [FAN, 184],
          [FAN, tabs[2].y + 20],
        ]}
        to={left(tabs[2])}
      />
    </Diagram>
  );
}

import { Router } from "jsr:@oak/oak/router";

interface SubscribeEvent {
  type: "SUBSCRIBE";
  channel: string;
  data: undefined;
}

interface UnsubscribeEvent {
  type: "UNSUB";
  channel: string;
  data: undefined;
}

interface PublishEvent {
  type: "PUBLISH";
  channel: string;
  data: object;
}

type WsEvent = SubscribeEvent | UnsubscribeEvent | PublishEvent;

export const messageBrokerRouter = new Router({
  prefix: "/ws_broker",
});

const SUBSCRIPTION_MAP: Map<string, Set<WebSocket>> = new Map();

function subscribe(ws: WebSocket, channel: string) {
  let set = SUBSCRIPTION_MAP.get(channel);
  if (!set) {
    set = new Set();
    SUBSCRIPTION_MAP.set(channel, set);
  }

  set.add(ws);
}

function unsubscribe(ws: WebSocket, channel: string) {
  const set = SUBSCRIPTION_MAP.get(channel);
  set?.delete(ws);
}

function publish(channel: string, data: unknown) {
  const serialized = JSON.stringify(data);

  const set = SUBSCRIPTION_MAP.get(channel);
  set?.forEach((x) => x.send(serialized));
}

function unsubscribeAll(ws: WebSocket) {
  SUBSCRIPTION_MAP.forEach((set) => set.delete(ws));
}

messageBrokerRouter.get("/", (ctx) => {
  if (!ctx.isUpgradable) {
    ctx.response.status = 400;
    return;
  }

  const ws = ctx.request.upgrade();
  ws.onopen = () => {
    console.log("new connection");
  };

  ws.onmessage = (evt) => {
    const jsonData: WsEvent = JSON.parse(evt.data);
    const { type, channel, data } = jsonData;

    switch (type) {
      case "UNSUB":
        unsubscribe(ws, channel);
        break;
      case "SUBSCRIBE":
        subscribe(ws, channel);
        break;
      case "PUBLISH":
        publish(channel, data);
        break;
    }
  };

  ws.onerror = () => unsubscribeAll(ws);
  ws.onclose = () => unsubscribeAll(ws);
});

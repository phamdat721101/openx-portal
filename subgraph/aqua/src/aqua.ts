import { Docked, Pulled, Pushed, Shipped } from "../generated/Aqua/Aqua";
import { Strategy, StrategyActivity, StrategyToken } from "../generated/schema";
import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

function strategyId(maker: string, app: string, hash: string): string {
  return maker.concat(":").concat(app).concat(":").concat(hash);
}

function recordActivity(id: string, kind: string, token: Bytes | null, amount: BigInt | null, event: ethereum.Event): void {
  let activity = new StrategyActivity(event.transaction.hash.toHexString().concat(":").concat(event.logIndex.toString()));
  activity.strategy = id;
  activity.kind = kind;
  if (token !== null) activity.token = token;
  if (amount !== null) activity.amount = amount;
  activity.transactionHash = event.transaction.hash;
  activity.logIndex = event.logIndex;
  activity.blockNumber = event.block.number;
  activity.timestamp = event.block.timestamp;
  activity.save();
}

function touchToken(id: string, token: Bytes, block: BigInt): void {
  let key = id.concat(":").concat(token.toHexString());
  let row = StrategyToken.load(key);
  if (row === null) {
    row = new StrategyToken(key);
    row.strategy = id;
    row.token = token;
  }
  row.lastActivityBlock = block;
  row.save();
}

export function handleShipped(event: Shipped): void {
  let id = strategyId(event.params.maker.toHexString(), event.params.app.toHexString(), event.params.strategyHash.toHexString());
  let strategy = new Strategy(id);
  strategy.maker = event.params.maker;
  strategy.app = event.params.app;
  strategy.strategyHash = event.params.strategyHash;
  strategy.lifecycle = "open";
  strategy.activityCount = 1;
  strategy.openedAtBlock = event.block.number;
  strategy.openedAtTimestamp = event.block.timestamp;
  strategy.save();
  recordActivity(id, "shipped", null, null, event);
}

export function handleDocked(event: Docked): void {
  let id = strategyId(event.params.maker.toHexString(), event.params.app.toHexString(), event.params.strategyHash.toHexString());
  let strategy = Strategy.load(id);
  if (strategy === null) return;
  strategy.lifecycle = "closed";
  strategy.closedAtBlock = event.block.number;
  strategy.activityCount += 1;
  strategy.save();
  recordActivity(id, "docked", null, null, event);
}

function handlePushedOrPulled(maker: Bytes, app: Bytes, strategyHash: Bytes, token: Bytes, amount: BigInt, event: ethereum.Event, kind: string): void {
  let id = strategyId(maker.toHexString(), app.toHexString(), strategyHash.toHexString());
  let strategy = Strategy.load(id);
  if (strategy === null || strategy.lifecycle !== "open") return;
  strategy.activityCount += 1;
  strategy.save();
  touchToken(id, token, event.block.number);
  recordActivity(id, kind, token, amount, event);
}

export function handlePushed(event: Pushed): void { handlePushedOrPulled(event.params.maker, event.params.app, event.params.strategyHash, event.params.token, event.params.amount, event, "pushed"); }
export function handlePulled(event: Pulled): void { handlePushedOrPulled(event.params.maker, event.params.app, event.params.strategyHash, event.params.token, event.params.amount, event, "pulled"); }

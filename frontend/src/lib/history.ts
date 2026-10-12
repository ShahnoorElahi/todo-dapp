import { Contract, EventLog } from "ethers";

export type TaskHistoryItem = {
  action: "Task Created" | "Task Completed" | "Task Updated" | "Task Deleted";
  taskId: string;
  wallet: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  details: string;
};

export async function fetchTaskHistory(
  contract: Contract,
  walletAddress: string
): Promise<TaskHistoryItem[]> {
  const filters = [
    ["TaskCreated", "Task Created"],
    ["TaskCompleted", "Task Completed"],
    ["TaskUpdated", "Task Updated"],
    ["TaskDeleted", "Task Deleted"],
  ] as const;

  const logsByType = await Promise.all(
    filters.map(async ([eventName, action]) => ({
      action,
      logs: await contract.queryFilter(contract.filters[eventName](walletAddress), 0, "latest"),
    }))
  );

  const history: TaskHistoryItem[] = [];
  for (const { action, logs } of logsByType) {
    for (const log of logs) {
      if (!("args" in log)) continue;
      const eventLog = log as EventLog;
      const taskId = String(eventLog.args[1]);
      let details: string;
      if (action === "Task Created") details = `Created task: ${String(eventLog.args[2])}`;
      else if (action === "Task Completed") details = `Task marked ${eventLog.args[2] ? "completed" : "incomplete"}`;
      else if (action === "Task Updated") details = `Task updated to: ${String(eventLog.args[2])}`;
      else details = "Task soft-deleted";
      history.push({
        action,
        taskId,
        wallet: String(eventLog.args[0]),
        blockNumber: eventLog.blockNumber,
        transactionHash: eventLog.transactionHash,
        timestamp: 0,
        details,
      });
    }
  }

  const provider = contract.runner?.provider;
  if (!provider) throw new Error("No blockchain provider is available.");

  const timestamps = new Map<number, number>();
  await Promise.all(history.map(async (item) => {
    if (!timestamps.has(item.blockNumber)) {
      const block = await provider.getBlock(item.blockNumber);
      timestamps.set(item.blockNumber, block?.timestamp ?? 0);
    }
    item.timestamp = timestamps.get(item.blockNumber) ?? 0;
  }));

  return history.sort((a, b) => b.blockNumber - a.blockNumber);
}


"use client";

import { fetchTaskHistory, type TaskHistoryItem } from "@/lib/history";
import { useEffect, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import { TODO_ABI, TODO_ADDRESS } from "@/lib/contract";

type Task = {
  id: bigint;
  content: string;
  completed: boolean;
  createdAt: bigint;
  deleted: boolean;
};

type View = "tasks" | "history";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string }) => Promise<unknown>;
      on: (
        event: "accountsChanged" | "chainChanged",
        listener: (value: unknown) => void
      ) => void;
      removeListener: (
        event: "accountsChanged" | "chainChanged",
        listener: (value: unknown) => void
      ) => void;
    };
  }
}

function getTransactionError(error: unknown): string {
  const err = error as {
    code?: number | string;
    shortMessage?: string;
    reason?: string;
    message?: string;
  };

  if (err.code === 4001 || err.code === "ACTION_REJECTED") {
    return "Transaction cancelled in MetaMask.";
  }

  const message = [err.shortMessage, err.reason, err.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    message.includes("insufficient funds") ||
    message.includes("insufficient balance")
  ) {
    return "Insufficient funds to pay the transaction fee.";
  }

  if (
    message.includes("wrong network") ||
    message.includes("chain id") ||
    message.includes("network changed")
  ) {
    return "Please switch MetaMask to Hardhat Local (chain ID 31337).";
  }

  if (
    message.includes("user rejected") ||
    message.includes("user denied")
  ) {
    return "Transaction cancelled in MetaMask.";
  }

  return (
    err.shortMessage ||
    err.reason ||
    err.message ||
    "Something went wrong. Please try again."
  );
}

export default function Home() {
  const [account, setAccount] = useState("");
  const [activeView, setActiveView] = useState<View>("tasks");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<bigint | null>(null);
  const [editedTaskContent, setEditedTaskContent] = useState("");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function getContract(write = false) {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask.");
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== 31337) {
      throw new Error(
        "Please switch MetaMask to Hardhat Local (chain ID 31337)."
      );
    }

    const signer = write ? await provider.getSigner() : undefined;

    return new Contract(TODO_ADDRESS, TODO_ABI, signer ?? provider);
  }

  async function loadTasks(walletAddress = account) {
    if (!walletAddress) {
      setTasks([]);
      return;
    }

    try {
      const contract = await getContract();

      const result = (await contract.getTasks({
        from: walletAddress,
      })) as Task[];

      setTasks(result.filter((task) => !task.deleted));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not load tasks."
      );
    }
  }

  async function loadHistory(walletAddress = account) {
    if (!walletAddress) {
      setHistory([]);
      return;
    }

    try {
      setHistoryLoading(true);

      const contract = await getContract();
      const events = await fetchTaskHistory(contract, walletAddress);

      setHistory(events);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not load transaction history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function connectWallet() {
    try {
      setNotice("");

      if (!window.ethereum) {
        throw new Error("Please install MetaMask.");
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const walletAddress = accounts[0] ?? "";

      setAccount(walletAddress);

      await loadTasks(walletAddress);
      await loadHistory(walletAddress);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Wallet connection failed."
      );
    }
  }

  function disconnectWallet() {
    setAccount("");
    setTasks([]);
    setHistory([]);
    setEditingTaskId(null);
    setEditedTaskContent("");
    setNewTask("");
    setNotice("");
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (value: unknown) => {
      const accounts = Array.isArray(value)
        ? value.filter(
            (item): item is string => typeof item === "string"
          )
        : [];

      const nextAccount = accounts[0] ?? "";

      setAccount(nextAccount);
      setTasks([]);
      setHistory([]);
      setEditingTaskId(null);
      setEditedTaskContent("");
      setNotice("");

      if (nextAccount) {
        void loadTasks(nextAccount);
        void loadHistory(nextAccount);
      }
    };

    const handleChainChanged = () => {
      setTasks([]);
      setHistory([]);
      setNotice(
        "Network changed. Please select Hardhat Local (chain ID 31337), then refresh your data."
      );
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );
      window.ethereum?.removeListener(
        "chainChanged",
        handleChainChanged
      );
    };
  }, []);

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || !newTask.trim() || !account) return;

    try {
      setLoading(true);
      setNotice("");

      const contract = await getContract(true);
      const tx = await contract.addTask(newTask.trim());

      await tx.wait();

      setNewTask("");

      await loadTasks();
      await loadHistory();

      setNotice("Task added successfully.");
    } catch (error: unknown) {
      setNotice(getTransactionError(error));
    } finally {
      setLoading(false);
    }
  }

  async function toggleTask(id: bigint) {
    if (loading) return;

    try {
      setLoading(true);
      setNotice("");

      const contract = await getContract(true);
      const tx = await contract.toggleTask(id);

      await tx.wait();

      await loadTasks();
      await loadHistory();
    } catch (error: unknown) {
      setNotice(getTransactionError(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTask(id: bigint) {
    if (loading) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setNotice("");

      const contract = await getContract(true);
      const tx = await contract.deleteTask(id);

      await tx.wait();

      await loadTasks();
      await loadHistory();

      setNotice("Task deleted successfully.");
    } catch (error: unknown) {
      setNotice(getTransactionError(error));
    } finally {
      setLoading(false);
    }
  }

  function startEditing(task: Task) {
    if (loading) return;

    setEditingTaskId(task.id);
    setEditedTaskContent(task.content);
    setNotice("");
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setEditedTaskContent("");
  }

  async function saveEditedTask(id: bigint) {
    const content = editedTaskContent.trim();

    if (loading || !content || !account || content.length > 200) return;

    try {
      setLoading(true);
      setNotice("");

      const contract = await getContract(true);
      const tx = await contract.updateTask(id, content);

      await tx.wait();

      setEditingTaskId(null);
      setEditedTaskContent("");

      await loadTasks();
      await loadHistory();

      setNotice("Task updated successfully.");
    } catch (error: unknown) {
      setNotice(getTransactionError(error));
    } finally {
      setLoading(false);
    }
  }

  const completed = tasks.filter((task) => task.completed).length;

  const tabClass = (view: View) =>
    `flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
      activeView === view
        ? "bg-violet-600 text-white shadow-lg shadow-violet-950/40"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-violet-400 sm:text-sm">
              Web3 · Productivity
            </p>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              On-chain <span className="text-violet-400">To-Do</span>
            </h1>

            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Your tasks, secured by your local blockchain.
            </p>
          </div>

          {account ? (
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <p className="text-xs text-emerald-400">Wallet connected</p>
                <p className="text-sm font-medium text-slate-200">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </p>
              </div>

              <button
                type="button"
                onClick={disconnectWallet}
                className="rounded-xl border border-slate-700 px-3 py-3 text-sm transition hover:border-violet-500 sm:px-4"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold transition hover:bg-violet-500"
            >
              Connect MetaMask
            </button>
          )}
        </header>

        {notice && (
          <div
            role="status"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200"
          >
            <p>{notice}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
              className="shrink-0 text-violet-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation: only one main view is rendered at a time. */}
        <nav
          aria-label="Main navigation"
          className="mb-6 flex gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2"
        >
          <button
            type="button"
            onClick={() => setActiveView("tasks")}
            aria-current={activeView === "tasks" ? "page" : undefined}
            className={tabClass("tasks")}
          >
            <span aria-hidden="true">☑</span>
            My Tasks
            {account && (
              <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-xs">
                {tasks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView("history")}
            aria-current={activeView === "history" ? "page" : undefined}
            className={tabClass("history")}
          >
            <span aria-hidden="true">↻</span>
            <span className="hidden sm:inline">Transaction History</span>
            <span className="sm:hidden">History</span>
            {account && (
              <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-xs">
                {history.length}
              </span>
            )}
          </button>
        </nav>

        {activeView === "tasks" && (
          <>
            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "Total tasks", value: tasks.length },
                { label: "Completed", value: completed },
                { label: "Remaining", value: tasks.length - completed },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700"
                >
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-bold">{item.value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
              <div className="mb-5">
                <p className="text-sm font-medium text-violet-400">
                  STAY ORGANIZED
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Create a task
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Add your next goal to the blockchain.
                </p>
              </div>

              <form
                onSubmit={addTask}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  value={newTask}
                  onChange={(event) => setNewTask(event.target.value)}
                  placeholder="What do you want to accomplish?"
                  maxLength={200}
                  disabled={loading || !account}
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-violet-500 disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={loading || !account || !newTask.trim()}
                  className="rounded-xl bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Processing..." : "+ Add Task"}
                </button>
              </form>

              <div className="mt-8 border-t border-slate-800 pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Your tasks</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Manage your on-chain task list.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadTasks()}
                    disabled={!account || loading}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-violet-300 transition hover:border-violet-500 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>

                {!account ? (
                  <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                    Connect MetaMask to view your tasks.
                  </p>
                ) : tasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                    <p className="text-2xl">✦</p>
                    <p className="mt-3 font-medium">No active tasks yet</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Add your first task using the form above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id.toString()}
                        className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 transition hover:border-slate-700 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <button
                          type="button"
                          onClick={() => void toggleTask(task.id)}
                          disabled={loading || editingTaskId !== null}
                          aria-label={
                            task.completed
                              ? "Mark task incomplete"
                              : "Complete task"
                          }
                          className={`flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full border transition sm:self-center ${
                            task.completed
                              ? "border-violet-500 bg-violet-600 text-white"
                              : "border-slate-600 hover:border-violet-400"
                          }`}
                        >
                          {task.completed ? "✓" : ""}
                        </button>

                        <div className="min-w-0 flex-1">
                          {editingTaskId === task.id ? (
                            <div className="space-y-3">
                              <input
                                autoFocus
                                value={editedTaskContent}
                                onChange={(event) =>
                                  setEditedTaskContent(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void saveEditedTask(task.id);
                                  }
                                  if (event.key === "Escape") {
                                    cancelEditing();
                                  }
                                }}
                                maxLength={200}
                                aria-label={`Edit task ${task.id.toString()}`}
                                className="w-full rounded-lg border border-violet-500 bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500/40"
                              />

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveEditedTask(task.id)}
                                  disabled={
                                    loading ||
                                    !editedTaskContent.trim() ||
                                    editedTaskContent.trim().length > 200
                                  }
                                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
                                >
                                  {loading ? "Processing..." : "Save"}
                                </button>

                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  disabled={loading}
                                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                className={
                                  task.completed
                                    ? "break-words text-slate-500 line-through"
                                    : "break-words text-slate-100"
                                }
                              >
                                {task.content}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Task #{task.id.toString()}
                              </p>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-col sm:items-end">
                          <span
                            className={`text-xs ${
                              task.completed
                                ? "text-violet-400"
                                : "text-slate-500"
                            }`}
                          >
                            {task.completed ? "Completed" : "Pending"}
                          </span>

                          {editingTaskId !== task.id && (
                            <button
                              type="button"
                              onClick={() => startEditing(task)}
                              disabled={loading || editingTaskId !== null}
                              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:border-violet-500 disabled:opacity-50"
                            >
                              Edit
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void deleteTask(task.id)}
                            disabled={loading || editingTaskId !== null}
                            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-500 hover:bg-red-950 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeView === "history" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-violet-400">
                  BLOCKCHAIN ACTIVITY
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Transaction History
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Review your wallet's recorded task events.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadHistory()}
                disabled={!account || historyLoading}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-violet-300 transition hover:border-violet-500 disabled:opacity-50"
              >
                {historyLoading ? "Loading..." : "Refresh history"}
              </button>
            </div>

            {!account ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                Connect your wallet to view its transaction history.
              </p>
            ) : historyLoading && history.length === 0 ? (
              <p className="p-8 text-center text-slate-400">
                Loading blockchain events...
              </p>
            ) : history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                No activity found for this wallet.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((item, index) => (
                  <div
                    key={`${item.transactionHash}-${item.action}-${index}`}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-lg text-violet-300">
                          {item.action === "Task Created"
                            ? "+"
                            : item.action === "Task Deleted"
                              ? "×"
                              : "✓"}
                        </span>

                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100">
                            {item.action}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-400">
                            {item.details}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full border border-violet-500/30 px-3 py-1 text-xs text-violet-300">
                        Task #{item.taskId}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 border-t border-slate-800 pt-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500">Date and time</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {item.timestamp
                            ? new Date(
                                item.timestamp * 1000
                              ).toLocaleString()
                            : "Unavailable"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Block number</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {item.blockNumber}
                        </p>
                      </div>

                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500">Wallet</p>
                        <p className="mt-1 break-all text-sm text-slate-300">
                          {item.wallet}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <p className="text-xs text-slate-500">
                        Transaction hash
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(item.transactionHash)
                            .then(() => {
                              setNotice("Transaction hash copied.");
                            })
                            .catch(() => {
                              setNotice(
                                "Could not copy the hash. Please copy it manually."
                              );
                            });
                        }}
                        title="Copy transaction hash"
                        className="mt-1 break-all text-left text-xs text-violet-400 hover:text-violet-300"
                      >
                        {item.transactionHash}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-slate-500">
          Powered by Solidity · Hardhat Local · ethers.js v6
        </footer>
      </div>
    </main>
  );
}

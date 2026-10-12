import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

async function setup() {
  const { ethers } = await network.connect();
  const todo = await ethers.deployContract("Todo");
  await todo.waitForDeployment();
  const [alice, bob] = await ethers.getSigners();
  return { todo, alice, bob };
}

describe("Todo security regression tests", () => {
  it("rejects empty and whitespace-only task content", async () => {
    const { todo, alice } = await setup();
    await assert.rejects(todo.connect(alice).addTask(""));
    await assert.rejects(todo.connect(alice).addTask("   \t\n"));
  });

  it("rejects content longer than the configured byte limit", async () => {
    const { todo, alice } = await setup();
    await assert.rejects(todo.connect(alice).addTask("a".repeat(201)));
  });

  it("creates a task with stable ID and correct initial state", async () => {
    const { todo, alice } = await setup();
    await todo.connect(alice).addTask("Buy milk");
    const tasks = await todo.connect(alice).getTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, 0n);
    assert.equal(tasks[0].content, "Buy milk");
    assert.equal(tasks[0].completed, false);
    assert.equal(tasks[0].deleted, false);
    assert.equal(await todo.connect(alice).getTaskCount(), 1n);
  });

  it("isolates tasks between wallets", async () => {
    const { todo, alice, bob } = await setup();

    // Alice creates a task. Bob creates no tasks.
    await todo.connect(alice).addTask("Alice task");

    const aliceTasks = await todo.connect(alice).getTasks();
    assert.equal(aliceTasks.length, 1);
    assert.equal(aliceTasks[0].content, "Alice task");

    const bobTasks = await todo.connect(bob).getTasks();
    assert.equal(bobTasks.length, 0);

    // Bob cannot modify, complete, or delete Alice's task.
    await assert.rejects(
      todo.connect(bob).updateTask(0, "Unauthorized update")
    );
    await assert.rejects(todo.connect(bob).toggleTask(0));
    await assert.rejects(todo.connect(bob).deleteTask(0));

    // Confirm Alice's task remains unchanged.
    const tasksAfter = await todo.connect(alice).getTasks();
    assert.equal(tasksAfter[0].content, "Alice task");
    assert.equal(tasksAfter[0].completed, false);
    assert.equal(tasksAfter[0].deleted, false);
  });

  it("rejects invalid task IDs", async () => {
    const { todo, alice } = await setup();
    await assert.rejects(todo.connect(alice).updateTask(99, "Updated"));
    await assert.rejects(todo.connect(alice).toggleTask(99));
    await assert.rejects(todo.connect(alice).deleteTask(99));
  });

  it("validates update content without changing the task", async () => {
    const { todo, alice } = await setup();
    await todo.connect(alice).addTask("Original");
    await assert.rejects(todo.connect(alice).updateTask(0, "  \t"));
    await assert.rejects(todo.connect(alice).updateTask(0, "x".repeat(201)));
    assert.equal((await todo.connect(alice).getTasks())[0].content, "Original");
  });

  it("toggles completion in both directions", async () => {
    const { todo, alice } = await setup();
    await todo.connect(alice).addTask("Complete me");
    await todo.connect(alice).toggleTask(0);
    assert.equal((await todo.connect(alice).getTasks())[0].completed, true);
    await todo.connect(alice).toggleTask(0);
    assert.equal((await todo.connect(alice).getTasks())[0].completed, false);
  });

  it("soft-deletes without shifting IDs and decrements active count once", async () => {
    const { todo, alice } = await setup();
    await todo.connect(alice).addTask("First");
    await todo.connect(alice).addTask("Second");
    await todo.connect(alice).deleteTask(0);
    const tasks = await todo.connect(alice).getTasks();
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].deleted, true);
    assert.equal(tasks[1].id, 1n);
    assert.equal(await todo.connect(alice).getTaskCount(), 1n);
    await assert.rejects(todo.connect(alice).deleteTask(0));
    await assert.rejects(todo.connect(alice).updateTask(0, "Revive"));
    await assert.rejects(todo.connect(alice).toggleTask(0));
    assert.equal(await todo.connect(alice).getTaskCount(), 1n);
  });
});

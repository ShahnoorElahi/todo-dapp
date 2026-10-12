
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("Todo - delete tasks", async function () {
  const { ethers } = await network.connect();

  async function deployTodo() {
    const todo = await ethers.deployContract("Todo");
    await todo.waitForDeployment();
    return todo;
  }

  it("deletes a task but preserves its ID", async function () {
    const todo = await deployTodo();

    await (await todo.addTask("First task")).wait();
    await (await todo.addTask("Second task")).wait();

    await (await todo.deleteTask(0)).wait();

    const tasks = await todo.getTasks();

    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].deleted, true);
    assert.equal(tasks[1].id, 1n);
    assert.equal(await todo.getTaskCount(), 1n);
  });

  it("emits TaskDeleted with the user's address and task ID", async function () {
    const todo = await deployTodo();
    const [alice] = await ethers.getSigners();

    await (await todo.connect(alice).addTask("Task to delete")).wait();

    const tx = await todo.connect(alice).deleteTask(0);
    const receipt = await tx.wait();

    assert.ok(receipt);

    const event = receipt.logs
      .map((log: any) => {
        try {
          return todo.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === "TaskDeleted");

    assert.ok(event, "TaskDeleted event should be emitted");
    assert.equal(event.args.owner.toLowerCase(), alice.address.toLowerCase());
    assert.equal(event.args.taskId, 0n);

    const tasks = await todo.connect(alice).getTasks();
    assert.equal(tasks[0].deleted, true);
  });

  it("rejects deleting a nonexistent task", async function () {
    const todo = await deployTodo();

    await assert.rejects(
      todo.deleteTask(0),
      /InvalidTaskId/
    );
  });

  it("rejects deleting the same task twice", async function () {
    const todo = await deployTodo();

    await (await todo.addTask("Only once")).wait();
    await (await todo.deleteTask(0)).wait();

    await assert.rejects(
      todo.deleteTask(0),
      /TaskAlreadyDeleted/
    );
  });

  it("prevents changing a deleted task", async function () {
    const todo = await deployTodo();

    await (await todo.addTask("Old content")).wait();
    await (await todo.deleteTask(0)).wait();

    await assert.rejects(
      todo.toggleTask(0),
      /TaskAlreadyDeleted/
    );

    await assert.rejects(
      todo.updateTask(0, "New content"),
      /TaskAlreadyDeleted/
    );
  });

  it("does not allow one wallet to delete another wallet's task", async function () {
    const todo = await deployTodo();
    const signers = await ethers.getSigners();

    const alice = signers[0];
    const bob = signers[1];

    await (await todo.connect(alice).addTask("Private task")).wait();

    // Bob has no task with ID 0 in his own wallet-scoped task list.
    await assert.rejects(
      todo.connect(bob).deleteTask(0),
      /InvalidTaskId/
    );

    // Confirm Alice's task was not changed.
    const aliceTasks = await todo.connect(alice).getTasks();

    assert.equal(aliceTasks.length, 1);
    assert.equal(aliceTasks[0].content, "Private task");
    assert.equal(aliceTasks[0].deleted, false);
  });
});

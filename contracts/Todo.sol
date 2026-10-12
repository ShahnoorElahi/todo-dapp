// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Todo
/// @notice Wallet-scoped task list with stable IDs and soft deletion.
/// @dev Each wallet can only read or mutate its own tasks. There is no privileged owner.
contract Todo {
    uint256 public constant MAX_CONTENT_BYTES = 200;

    struct Task {
        uint256 id;
        string content;
        bool completed;
        uint256 createdAt;
        bool deleted;
    }

    mapping(address => Task[]) private tasksByOwner;
    mapping(address => uint256) private activeTaskCounts;

    event TaskCreated(address indexed owner, uint256 indexed taskId, string content);
    event TaskCompleted(address indexed owner, uint256 indexed taskId, bool completed);
    event TaskUpdated(address indexed owner, uint256 indexed taskId, string content);
    event TaskDeleted(address indexed owner, uint256 indexed taskId);

    error EmptyContent();
    error ContentTooLong(uint256 suppliedBytes, uint256 maximumBytes);
    error InvalidTaskId(uint256 taskId);
    error TaskAlreadyDeleted(uint256 taskId);

    /// @notice Create a task for the calling wallet.
    function addTask(string calldata content) external returns (uint256 taskId) {
        _validateContent(content);

        Task[] storage ownTasks = tasksByOwner[msg.sender];
        taskId = ownTasks.length;
        ownTasks.push(Task({
            id: taskId,
            content: content,
            completed: false,
            createdAt: block.timestamp,
            deleted: false
        }));
        activeTaskCounts[msg.sender] += 1;

        emit TaskCreated(msg.sender, taskId, content);
    }

    /// @notice Return all tasks belonging to the calling wallet, including soft-deleted records.
    /// @dev Returning deleted records preserves stable IDs and makes deletion status explicit.
    function getTasks() external view returns (Task[] memory) {
        return tasksByOwner[msg.sender];
    }

    /// @notice Number of active (non-deleted) tasks belonging to the calling wallet.
    function getTaskCount() external view returns (uint256) {
        return activeTaskCounts[msg.sender];
    }

    /// @notice Replace content on an active task belonging to the caller.
    function updateTask(uint256 taskId, string calldata newContent) external {
        _validateContent(newContent);
        Task storage task = _activeTask(msg.sender, taskId);
        task.content = newContent;
        emit TaskUpdated(msg.sender, taskId, newContent);
    }

    /// @notice Toggle completion on an active task belonging to the caller.
    function toggleTask(uint256 taskId) external {
        Task storage task = _activeTask(msg.sender, taskId);
        task.completed = !task.completed;
        emit TaskCompleted(msg.sender, taskId, task.completed);
    }

    /// @notice Soft-delete an active task; its ID and event history remain stable.
    function deleteTask(uint256 taskId) external {
        Task storage task = _activeTask(msg.sender, taskId);
        task.deleted = true;
        activeTaskCounts[msg.sender] -= 1;
        emit TaskDeleted(msg.sender, taskId);
    }

    function _activeTask(address owner, uint256 taskId) private view returns (Task storage task) {
        Task[] storage ownTasks = tasksByOwner[owner];
        if (taskId >= ownTasks.length) revert InvalidTaskId(taskId);
        task = ownTasks[taskId];
        if (task.deleted) revert TaskAlreadyDeleted(taskId);
    }

    function _validateContent(string calldata content) private pure {
        bytes calldata raw = bytes(content);
        if (raw.length == 0) revert EmptyContent();
        if (raw.length > MAX_CONTENT_BYTES) {
            revert ContentTooLong(raw.length, MAX_CONTENT_BYTES);
        }
        bool hasNonWhitespace;
        for (uint256 i; i < raw.length; ++i) {
            bytes1 c = raw[i];
            // ASCII whitespace: tab through carriage return, and ordinary space.
            if (!((c >= 0x09 && c <= 0x0D) || c == 0x20)) {
                hasNonWhitespace = true;
                break;
            }
        }
        if (!hasNonWhitespace) revert EmptyContent();
    }
}

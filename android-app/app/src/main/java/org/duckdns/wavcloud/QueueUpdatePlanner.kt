package org.duckdns.wavcloud

internal sealed interface QueueOperation {
    data class Insert(val index: Int) : QueueOperation
    data class Move(val from: Int, val to: Int) : QueueOperation
    data class Remove(val index: Int) : QueueOperation
}

internal object QueueUpdatePlanner {
    fun plan(current: List<String>, desired: List<String>): List<QueueOperation> {
        val working = current.toMutableList()
        val operations = mutableListOf<QueueOperation>()

        desired.forEachIndexed { index, id ->
            if (working.getOrNull(index) == id) return@forEachIndexed
            val existing = ((index + 1) until working.size).firstOrNull { working[it] == id }
            if (existing == null) {
                working.add(index, id)
                operations.add(QueueOperation.Insert(index))
            } else {
                working.add(index, working.removeAt(existing))
                operations.add(QueueOperation.Move(existing, index))
            }
        }

        while (working.size > desired.size) {
            val index = working.lastIndex
            working.removeAt(index)
            operations.add(QueueOperation.Remove(index))
        }
        check(working == desired) { "Queue reconciliation produced an unexpected order" }
        return operations
    }
}

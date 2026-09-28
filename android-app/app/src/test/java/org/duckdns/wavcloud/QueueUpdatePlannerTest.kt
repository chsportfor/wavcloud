package org.duckdns.wavcloud

import org.junit.Assert.assertEquals
import org.junit.Test

class QueueUpdatePlannerTest {
    @Test
    fun addingNextTrackKeepsTheCurrentItem() {
        val current = listOf("playing", "later")
        val desired = listOf("playing", "next", "later")
        assertEquals(listOf(QueueOperation.Insert(1)), QueueUpdatePlanner.plan(current, desired))
        assertEquals(desired, apply(current, desired))
    }

    @Test
    fun reorderAndRemovalDoNotReplaceTheQueue() {
        val current = listOf("playing", "one", "two", "three")
        val desired = listOf("playing", "three", "one")
        assertEquals(desired, apply(current, desired))
        assertEquals(0, QueueUpdatePlanner.plan(current, desired).count { it is QueueOperation.Insert })
    }

    @Test
    fun clearingAndUnchangedQueueAreHandled() {
        assertEquals(emptyList<QueueOperation>(), QueueUpdatePlanner.plan(listOf("a"), listOf("a")))
        assertEquals(emptyList<String>(), apply(listOf("a", "b"), emptyList()))
    }

    @Test
    fun repeatedTrackIdsKeepTheRequestedOrder() {
        val current = listOf("playing", "repeat", "other", "repeat")
        val desired = listOf("playing", "repeat", "repeat", "other")
        assertEquals(desired, apply(current, desired))
    }

    private fun apply(current: List<String>, desired: List<String>): List<String> {
        val working = current.toMutableList()
        QueueUpdatePlanner.plan(current, desired).forEach { operation ->
            when (operation) {
                is QueueOperation.Insert -> working.add(operation.index, desired[operation.index])
                is QueueOperation.Move -> working.add(operation.to, working.removeAt(operation.from))
                is QueueOperation.Remove -> working.removeAt(operation.index)
            }
        }
        return working
    }
}

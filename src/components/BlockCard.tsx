import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme, s, r, t, domainColor } from "@/src/theme";
import { Feather } from "@expo/vector-icons";
import type { Block, Task } from "@/src/engine/planner";

interface Props {
  block: Block;
  isDone: (blockId: string, taskId: string) => boolean;
  onToggle: (blockId: string, taskId: string, weekItemId?: string) => void;
  onWhy: (block: Block, task?: Task) => void;
  onReview?: (task: Task) => void;
}

export function BlockCard({ block, isDone, onToggle, onWhy, onReview }: Props) {
  const { c, mode } = useTheme();
  const totalTasks = block.tasks.length;
  const doneCount = block.tasks.filter((task) => isDone(block.id, task.id)).length;

  return (
    <View style={[styles.card, { backgroundColor: c.surface2, borderColor: c.border }]} testID={`block-${block.id}`}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.overline, { color: c.textFaint, fontFamily: t.monoFont }]}>{block.type.replace("_", " ").toUpperCase()} · {block.durationMin}m</Text>
          <Text style={[styles.label, { color: c.text }]} numberOfLines={2}>{block.label}</Text>
        </View>
        <Text style={[styles.progress, { color: c.textDim, fontFamily: t.monoFont }]}>{doneCount}/{totalTasks}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      {block.tasks.map((task) => {
        const done = isDone(block.id, task.id);
        const dc = domainColor(task.domain, mode);
        return (
          <Pressable
            key={task.id}
            testID={`task-${task.id}`}
            onPress={() => onToggle(block.id, task.id, task.weekItemId || undefined)}
            style={styles.task}
          >
            <View style={[styles.check, { borderColor: done ? c.text : c.borderStrong, backgroundColor: done ? c.text : "transparent" }]}>
              {done && <Feather name="check" size={14} color={c.onBrand} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.taskTitleRow}>
                <View style={[styles.domainDot, { backgroundColor: dc }]} />
                <Text style={[styles.taskTitle, { color: c.text, textDecorationLine: done ? "line-through" : "none" }]} numberOfLines={2}>
                  {task.title}
                </Text>
              </View>
              {task.detail ? <Text style={[styles.taskDetail, { color: c.textFaint }]} numberOfLines={3}>{task.detail}</Text> : null}
              <View style={styles.metaRow}>
                <Text style={[styles.meta, { color: c.textFaint, fontFamily: t.monoFont }]}>{task.durationMin}m</Text>
                {task.expectedOutput ? (
                  <>
                    <Text style={[styles.meta, { color: c.textFaint }]}> · </Text>
                    <Text style={[styles.meta, { color: c.textFaint }]} numberOfLines={1}>{task.expectedOutput}</Text>
                  </>
                ) : null}
              </View>
              {done && task.reviewable && onReview ? (
                <Pressable testID={`review-${task.id}`} onPress={() => onReview(task)} style={[styles.reviewCTA, { borderColor: c.borderStrong }]}>
                  <Feather name="message-circle" size={12} color={c.textDim} />
                  <Text style={[styles.reviewCTAText, { color: c.textDim }]}>Get external AI review</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable testID={`why-${task.id}`} hitSlop={10} onPress={() => onWhy(block, task)} style={{ padding: 4 }}>
              <Feather name="help-circle" size={14} color={c.textFaint} />
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: r.md, borderWidth: 0.5, padding: s.lg, marginBottom: s.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: s.sm },
  overline: { fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "600" },
  label: { fontSize: t.size.md, fontWeight: "700", marginTop: 2 },
  progress: { fontSize: t.size.sm, fontWeight: "600" },
  divider: { height: 0.5, marginVertical: s.sm },
  task: { flexDirection: "row", gap: s.md, paddingVertical: s.sm },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 2 },
  taskTitleRow: { flexDirection: "row", alignItems: "center", gap: s.sm },
  domainDot: { width: 6, height: 6, borderRadius: 3 },
  taskTitle: { fontSize: t.size.base, fontWeight: "600", flex: 1 },
  taskDetail: { fontSize: t.size.sm, marginTop: 3, lineHeight: 19 },
  metaRow: { flexDirection: "row", marginTop: 4, alignItems: "center" },
  meta: { fontSize: t.size.xs, fontWeight: "500" },
  reviewCTA: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: r.pill, borderWidth: 0.5 },
  reviewCTAText: { fontSize: 11, fontWeight: "600" },
});

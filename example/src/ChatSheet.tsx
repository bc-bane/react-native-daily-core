import React, {useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Sheet} from './Sheet';
import {call} from './theme';

export type ChatLine = {id: string; name: string; text: string};

export function ChatSheet({
  visible,
  messages,
  onClose,
  onSend,
}: {
  visible: boolean;
  messages: ChatLine[];
  onClose: () => void;
  onSend: (text: string) => Promise<void>;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="Chat" visible={visible} onClose={onClose}>
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.muted}>Messages stay in this call.</Text>}
        renderItem={({item}) => (
          <View style={styles.line}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message everyone"
          placeholderTextColor={call.muted}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const text = draft.trim();
            if (!text) {
              return;
            }
            void (async () => {
              try {
                await onSend(text);
                setDraft('');
                setError(null);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              }
            })();
          }}
          style={styles.send}>
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {maxHeight: 280},
  line: {paddingVertical: 8, gap: 2},
  name: {color: call.accent, fontWeight: '700'},
  text: {color: call.text},
  muted: {color: call.muted},
  error: {color: '#ffd7df'},
  composer: {flexDirection: 'row', gap: 8, alignItems: 'center'},
  input: {
    flex: 1,
    color: call.text,
    borderWidth: 1,
    borderColor: call.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  send: {backgroundColor: call.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10},
  sendLabel: {color: '#fff', fontWeight: '700'},
});

import React from 'react'
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'

export default function SelectModal({ visible, title, options, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={item => String(item.value)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.option} onPress={() => { onSelect(item); onClose() }}>
              <Text style={styles.optionText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      { backgroundColor: '#0c1120', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: '60%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  handle:     { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  title:      { fontSize: 16, fontWeight: '700', color: '#ffffff', paddingHorizontal: 20, paddingVertical: 12 },
  option:     { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  optionText: { fontSize: 15, color: '#ffffff' },
  cancel:     { marginHorizontal: 20, marginTop: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
})

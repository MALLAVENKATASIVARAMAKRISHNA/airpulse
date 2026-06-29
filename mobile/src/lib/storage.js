import * as SecureStore from 'expo-secure-store'

export const Storage = {
  setToken: (t)  => SecureStore.setItemAsync('ap_token', t),
  getToken: ()   => SecureStore.getItemAsync('ap_token'),
  removeToken:() => SecureStore.deleteItemAsync('ap_token'),
  setUser:  (u)  => SecureStore.setItemAsync('ap_user', JSON.stringify(u)),
  getUser:  async () => {
    const s = await SecureStore.getItemAsync('ap_user')
    return s ? JSON.parse(s) : null
  },
  removeUser: () => SecureStore.deleteItemAsync('ap_user'),
  clear: async () => {
    await SecureStore.deleteItemAsync('ap_token')
    await SecureStore.deleteItemAsync('ap_user')
  },
}

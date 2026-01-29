import { ref, onUnmounted } from 'vue'

export function useInteractiveCompiler(apiBase = 'ws://localhost:3000') {
  const socket = ref(null)
  const output = ref([])
  const status = ref('idle') // 'idle' | 'running' | 'exited' | 'error'
  const isConnected = ref(false)
  const exitCode = ref(null)

  // Ensure getting the correct WS URL from HTTP URL
  const getWsUrl = (baseUrl) => {
    const url = new URL(baseUrl)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${url.origin}/compile/ws`
  }

  const runCode = (language, code) => {
    // Reset state
    status.value = 'running'
    output.value = []
    exitCode.value = null

    // Close existing connection if any
    if (socket.value) {
      socket.value.close()
    }

    try {
      const wsUrl = getWsUrl(apiBase)
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        isConnected.value = true
        // Send Init message
        ws.send(JSON.stringify({ type: 'init', language, code }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          switch (msg.type) {
            case 'stdout':
              // Append to terminal
              output.value.push({ type: 'stdout', data: msg.data })
              break
            case 'stderr':
              // Append to terminal as error
              output.value.push({ type: 'stderr', data: msg.data })
              break
            case 'exit':
              status.value = 'exited'
              exitCode.value = msg.code
              // Exit code is in msg.code
              ws.close()
              break
            case 'error':
              console.error('Compiler error:', msg.error)
              output.value.push({ type: 'system-error', data: `Error: ${msg.error}\n` })
              status.value = 'error'
              ws.close()
              break
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e)
        }
      }

      ws.onclose = () => {
        isConnected.value = false
        if (status.value === 'running') {
          status.value = 'exited'
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        status.value = 'error'
        output.value.push({ type: 'system-error', data: 'Connection error occurred.\n' })
        isConnected.value = false
      }

      socket.value = ws
    } catch (err) {
      console.error('Failed to connect:', err)
      status.value = 'error'
      output.value.push({ type: 'system-error', data: `Failed to start: ${err.message}\n` })
    }
  }

  const sendInput = (text) => {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      // Send input
      socket.value.send(JSON.stringify({ type: 'stdin', data: text }))
      // Local echo (optional, but good for terminals)
      // We might want to mark it as user input to style it differently
      output.value.push({ type: 'stdin', data: text })
    }
  }

  const kill = () => {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({ type: 'kill' }))
    }
    // Force close client side too
    if (socket.value) {
      socket.value.close()
    }
    status.value = 'exited'
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (socket.value) {
      socket.value.close()
    }
  })

  return {
    runCode,
    sendInput,
    kill,
    output,
    status,
    exitCode,
    isConnected,
  }
}

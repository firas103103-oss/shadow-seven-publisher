/**
 * Collaboration Context — Local sync
 * يمكن إضافة WebSocket لاحقاً للتعاون المباشر
 */

import React, { createContext, useContext, useState, useCallback } from 'react'

const CollaborationContext = createContext()

export const useCollaboration = () => {
  const context = useContext(CollaborationContext)
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborationProvider')
  }
  return context
}

export const CollaborationProvider = ({ children }) => {
  const [activeUsers, setActiveUsers] = useState([])
  const [currentDocument, setCurrentDocument] = useState(null)
  const [changes, setChanges] = useState([])

  const initCollaboration = useCallback(async (documentId, userId) => {
    setCurrentDocument(documentId)
    setActiveUsers([{ userId, timestamp: new Date().toISOString() }])
    return { documentId }
  }, [])

  const endCollaboration = useCallback(async () => {
    setCurrentDocument(null)
    setActiveUsers([])
    setChanges([])
  }, [])

  const broadcastChange = useCallback(async (change) => {
    setChanges(prev => [...prev, { ...change, timestamp: new Date().toISOString() }])
  }, [])

  const broadcastCursor = useCallback(async () => {}, [])

  const getActiveUsersCount = useCallback(() => activeUsers.length, [activeUsers])

  const isUserActive = useCallback((userId) => activeUsers.some(u => u.userId === userId), [activeUsers])

  const value = {
    activeUsers,
    currentDocument,
    changes,
    initCollaboration,
    endCollaboration,
    broadcastChange,
    broadcastCursor,
    getActiveUsersCount,
    isUserActive
  }

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  )
}

export default CollaborationProvider

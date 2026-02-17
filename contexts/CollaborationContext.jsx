import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';

const CollaborationContext = createContext();

export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborationProvider');
  }
  return context;
};

export const CollaborationProvider = ({ children }) => {
  const [activeUsers, setActiveUsers] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [changes, setChanges] = useState([]);
  const [channel, setChannel] = useState(null);

  // Initialize collaboration for a document
  const initCollaboration = useCallback(async (documentId, userId) => {
    try {
      setCurrentDocument(documentId);

      // Create a Supabase channel for this document
      const newChannel = supabase.channel(`document:${documentId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: userId }
        }
      });

      // Subscribe to presence changes
      newChannel
        .on('presence', { event: 'sync' }, () => {
          const state = newChannel.presenceState();
          const users = Object.values(state).flat();
          setActiveUsers(users);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left:', leftPresences);
        })
        .on('broadcast', { event: 'text-change' }, ({ payload }) => {
          setChanges(prev => [...prev, payload]);
        })
        .on('broadcast', { event: 'cursor-move' }, ({ payload }) => {
          // Handle cursor position changes
          console.log('Cursor moved:', payload);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await newChannel.track({
              userId,
              timestamp: new Date().toISOString()
            });
          }
        });

      setChannel(newChannel);
      return newChannel;
    } catch (error) {
      console.error('Error initializing collaboration:', error);
      throw error;
    }
  }, []);

  // End collaboration
  const endCollaboration = useCallback(async () => {
    if (channel) {
      await supabase.removeChannel(channel);
      setChannel(null);
      setCurrentDocument(null);
      setActiveUsers([]);
      setChanges([]);
    }
  }, [channel]);

  // Broadcast text change
  const broadcastChange = useCallback(async (change) => {
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'text-change',
      payload: {
        ...change,
        timestamp: new Date().toISOString()
      }
    });
  }, [channel]);

  // Broadcast cursor position
  const broadcastCursor = useCallback(async (position) => {
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'cursor-move',
      payload: {
        position,
        timestamp: new Date().toISOString()
      }
    });
  }, [channel]);

  // Get active users count
  const getActiveUsersCount = useCallback(() => {
    return activeUsers.length;
  }, [activeUsers]);

  // Check if a user is active
  const isUserActive = useCallback((userId) => {
    return activeUsers.some(user => user.userId === userId);
  }, [activeUsers]);

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
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

export default CollaborationProvider;

import { useState, useCallback, useEffect } from 'react';

export const useChatCategories = () => {
  const [categories, setCategories] = useState<string[]>([
    'Sales Analysis',
    'Inventory Management', 
    'Product Research',
    'General Questions',
    'Reports',
    'Data Export'
  ]);

  // Load categories from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('mcpChatCategories');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCategories(parsed);
        }
      } catch (e) {
        console.warn('Failed to load categories from localStorage');
      }
    }
  }, []);

  // Save categories to localStorage when they change
  useEffect(() => {
    localStorage.setItem('mcpChatCategories', JSON.stringify(categories));
  }, [categories]);

  const addCategory = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (trimmedName && !categories.includes(trimmedName)) {
      setCategories(prev => [...prev, trimmedName]);
      return true;
    }
    return false;
  }, [categories]);

  const removeCategory = useCallback((name: string) => {
    setCategories(prev => prev.filter(cat => cat !== name));
  }, []);

  const renameCategory = useCallback((oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (trimmedNew && !categories.includes(trimmedNew)) {
      setCategories(prev => 
        prev.map(cat => cat === oldName ? trimmedNew : cat)
      );
      return true;
    }
    return false;
  }, [categories]);

  return {
    categories,
    addCategory,
    removeCategory,
    renameCategory
  };
};

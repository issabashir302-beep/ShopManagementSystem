import { useState } from 'react'
export function useFormModal() { const [value, setValue] = useState(null); return { value, open: (next = true) => setValue(next), close: () => setValue(null), isOpen: value !== null } }

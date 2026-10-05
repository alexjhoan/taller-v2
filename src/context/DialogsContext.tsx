import { ReactNode, createContext, useContext, useState } from 'react';

interface DialogState {
  open: boolean;
  data: string;
}

interface DialogsContextType {
  dialogCreateUser: DialogState;
  setDialogCreateUser: React.Dispatch<React.SetStateAction<DialogState>>;
  dialogCreateUserRole: DialogState;
  setDialogCreateUserRole: React.Dispatch<React.SetStateAction<DialogState>>;
}

const initialDialogState: DialogState = { open: false, data: '' };

const initialContext: DialogsContextType = {
  dialogCreateUser: initialDialogState,
  setDialogCreateUser: () => {},
  dialogCreateUserRole: initialDialogState,
  setDialogCreateUserRole: () => {},
};

const DialogsContext = createContext<DialogsContextType>(initialContext);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [dialogCreateUser, setDialogCreateUser] = useState<DialogState>(initialDialogState);
  const [dialogCreateUserRole, setDialogCreateUserRole] = useState<DialogState>(initialDialogState);

  const globalState: DialogsContextType = {
    dialogCreateUser,
    setDialogCreateUser,
    dialogCreateUserRole,
    setDialogCreateUserRole,
  };

  return <DialogsContext.Provider value={globalState}>{children}</DialogsContext.Provider>;
}

export const useDialogsContext = () => useContext(DialogsContext);

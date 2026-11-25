import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, CreateMenu, Menu, MenuAccess, MenuRight, ReplaceMenuRights, UpdateMenu, UserRole } from '@arcade/contracts';
import { api } from '../api';
import { logout } from './authSlice';

type ResourceStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
type MenuRightsPayload = { role: UserRole; rights: MenuRight[] };

type MenusState = {
  menus: Menu[];
  menusStatus: ResourceStatus;
  menusError: string | null;
  rights: MenuRight[];
  rightsRole: UserRole | null;
  rightsStatus: ResourceStatus;
  rightsError: string | null;
  access: MenuAccess[];
  accessStatus: ResourceStatus;
  accessError: string | null;
  saveStatus: ResourceStatus;
  saveError: string | null;
};

const initialState: MenusState = {
  menus: [],
  menusStatus: 'idle',
  menusError: null,
  rights: [],
  rightsRole: null,
  rightsStatus: 'idle',
  rightsError: null,
  access: [],
  accessStatus: 'idle',
  accessError: null,
  saveStatus: 'idle',
  saveError: null,
};

export const fetchMenus = createAsyncThunk<Menu[]>('menus/fetchMenus', async () => {
  const response = await api<ApiSuccess<Menu[]>>('/api/identity/menus');
  return response.data;
});

export const fetchMenuAccess = createAsyncThunk<MenuAccess[]>('menus/fetchAccess', async () => {
  const response = await api<ApiSuccess<MenuAccess[]>>('/api/identity/menus/access');
  return response.data;
});

export const fetchMenuRights = createAsyncThunk<MenuRightsPayload, UserRole>(
  'menus/fetchRights',
  async (role) => {
    const response = await api<ApiSuccess<MenuRightsPayload>>(`/api/identity/menu-rights?role=${role}`);
    return response.data;
  },
);

export const createMenu = createAsyncThunk<Menu, CreateMenu>('menus/create', async (input) => {
  const response = await api<ApiSuccess<Menu>>('/api/identity/menus', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
});

export const updateMenu = createAsyncThunk<Menu, { id: string } & UpdateMenu>(
  'menus/update',
  async ({ id, ...patch }) => {
    const response = await api<ApiSuccess<Menu>>(`/api/identity/menus/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return response.data;
  },
);

export const deleteMenu = createAsyncThunk<string, string>('menus/delete', async (id) => {
  await api<void>(`/api/identity/menus/${id}`, { method: 'DELETE' });
  return id;
});

export const saveMenuRights = createAsyncThunk<MenuRightsPayload, ReplaceMenuRights>(
  'menus/saveRights',
  async (input) => {
    const response = await api<ApiSuccess<MenuRightsPayload>>('/api/identity/menu-rights', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    return response.data;
  },
);

function withoutBranch(menus: Menu[], id: string): Menu[] {
  const drop = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const menu of menus) {
      if (menu.parentId && drop.has(menu.parentId) && !drop.has(menu.id)) {
        drop.add(menu.id);
        grew = true;
      }
    }
  }
  return menus.filter((menu) => !drop.has(menu.id));
}

const menusSlice = createSlice({
  name: 'menus',
  initialState,
  reducers: {
    clearMenuSaveError(state) {
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMenus.pending, (state) => {
        state.menusStatus = 'loading';
        state.menusError = null;
      })
      .addCase(fetchMenus.fulfilled, (state, action) => {
        state.menusStatus = 'succeeded';
        state.menus = action.payload;
      })
      .addCase(fetchMenus.rejected, (state, action) => {
        state.menusStatus = 'failed';
        state.menusError = action.error.message ?? 'Could not load menus';
      })
      .addCase(fetchMenuAccess.pending, (state) => {
        state.accessStatus = 'loading';
        state.accessError = null;
      })
      .addCase(fetchMenuAccess.fulfilled, (state, action) => {
        state.accessStatus = 'succeeded';
        state.access = action.payload;
      })
      .addCase(fetchMenuAccess.rejected, (state, action) => {
        state.accessStatus = 'failed';
        state.accessError = action.error.message ?? 'Could not load menu access';
      })
      .addCase(fetchMenuRights.pending, (state) => {
        state.rightsStatus = 'loading';
        state.rightsError = null;
      })
      .addCase(fetchMenuRights.fulfilled, (state, action) => {
        state.rightsStatus = 'succeeded';
        state.rightsRole = action.payload.role;
        state.rights = action.payload.rights;
      })
      .addCase(fetchMenuRights.rejected, (state, action) => {
        state.rightsStatus = 'failed';
        state.rightsError = action.error.message ?? 'Could not load menu rights';
      })
      .addCase(createMenu.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        state.menus.unshift(action.payload);
      })
      .addCase(updateMenu.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        const index = state.menus.findIndex((menu) => menu.id === action.payload.id);
        if (index >= 0) state.menus[index] = action.payload;
      })
      .addCase(deleteMenu.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        state.menus = withoutBranch(state.menus, action.payload);
      })
      .addCase(saveMenuRights.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        state.rightsRole = action.payload.role;
        state.rights = action.payload.rights;
      })
      .addMatcher(
        (action) => [
          createMenu.pending.type,
          updateMenu.pending.type,
          deleteMenu.pending.type,
          saveMenuRights.pending.type,
        ].includes(action.type),
        (state) => {
          state.saveStatus = 'loading';
          state.saveError = null;
        },
      )
      .addMatcher(
        (action): action is { type: string; error: { message?: string } } =>
          [
            createMenu.rejected.type,
            updateMenu.rejected.type,
            deleteMenu.rejected.type,
            saveMenuRights.rejected.type,
          ].includes(action.type),
        (state, action) => {
          state.saveStatus = 'failed';
          state.saveError = action.error.message ?? 'Request failed';
        },
      )
      .addMatcher((action) => action.type === logout.type, () => initialState);
  },
});

export const { clearMenuSaveError } = menusSlice.actions;
export default menusSlice.reducer;

export type StoreData = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type StoreListData = StoreData[];

export type StoreApiRequestData = void;

export type CreateStoreApiRequestData = { name: string };

export type UpdateStoreApiRequestData = Partial<CreateStoreApiRequestData>;

export type ToneSettingsData = {
  store_id: string;
  tone: string;
  extra_instruction: string | null;
  updated_at: string;
};

export type ToneSettingsApiRequestData = {
  tone?: string;
  extra_instruction?: string | null;
};

import { SetMetadata } from "@nestjs/common";

export const STORE_ACCESS_KEY = "store:audience";
export const StoreAccess = () => SetMetadata(STORE_ACCESS_KEY, true);

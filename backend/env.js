// Load backend/.env regardless of the directory the server is started from.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)), quiet: true });

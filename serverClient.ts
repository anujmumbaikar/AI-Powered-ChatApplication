import {StreamChat} from 'stream-chat';

export const apikey = process.env.STREAM_API_KEY as string;
export const secret = process.env.STREAM_API_SECRET as string;

if(!apikey || !secret) {
  throw new Error('STREAM_API_KEY and STREAM_API_SECRET must be set in the environment variables');
}
export const serverClient = new StreamChat(apikey, secret); 
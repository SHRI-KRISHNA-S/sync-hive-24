 // Extended types for our app
 export interface Profile {
   id: string;
   user_id: string;
   username: string;
   display_name: string | null;
   avatar_url: string | null;
   status: string;
   last_seen: string;
   created_at: string;
   updated_at: string;
 }
 
 export interface Team {
   id: string;
   name: string;
   description: string | null;
   icon_url: string | null;
   invite_code: string;
   created_by: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface TeamMember {
   id: string;
   team_id: string;
   user_id: string;
   role: 'owner' | 'admin' | 'member';
   joined_at: string;
 }
 
 export interface Channel {
   id: string;
   team_id: string;
   name: string;
   description: string | null;
   is_private: boolean;
   created_by: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface Message {
   id: string;
   channel_id: string;
   user_id: string;
   content: string;
   has_attachments: boolean;
   created_at: string;
   updated_at: string;
   profiles?: Profile;
 }
 
 export interface DirectMessage {
   id: string;
   sender_id: string;
   receiver_id: string;
   content: string;
   has_attachments: boolean;
   read_at: string | null;
   created_at: string;
   sender_profile?: Profile;
   receiver_profile?: Profile;
 }
 
 export interface TypingUser {
   user_id: string;
   username: string;
   channel_id: string;
 }
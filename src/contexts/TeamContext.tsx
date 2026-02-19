 import React, { createContext, useContext, useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './AuthContext';
 import { Team, Channel, TeamMember, Profile } from '@/lib/supabase-types';
 
 interface TeamContextType {
   teams: Team[];
   currentTeam: Team | null;
   currentChannel: Channel | null;
   channels: Channel[];
   teamMembers: (TeamMember & { profile: Profile })[];
   loading: boolean;
   setCurrentTeam: (team: Team | null) => void;
   setCurrentChannel: (channel: Channel | null) => void;
   createTeam: (name: string, description?: string) => Promise<Team | null>;
   joinTeam: (inviteCode: string) => Promise<boolean>;
   createChannel: (name: string, description?: string) => Promise<Channel | null>;
   refreshTeams: () => Promise<void>;
 }
 
 const TeamContext = createContext<TeamContextType | undefined>(undefined);
 
 export const useTeam = () => {
   const context = useContext(TeamContext);
   if (!context) {
     throw new Error('useTeam must be used within a TeamProvider');
   }
   return context;
 };
 
 export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const { user } = useAuth();
   const [teams, setTeams] = useState<Team[]>([]);
   const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
   const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
   const [channels, setChannels] = useState<Channel[]>([]);
   const [teamMembers, setTeamMembers] = useState<(TeamMember & { profile: Profile })[]>([]);
   const [loading, setLoading] = useState(true);
 
   const refreshTeams = async () => {
     if (!user) return;
     
     const { data: memberData } = await supabase
       .from('team_members')
       .select('team_id')
       .eq('user_id', user.id);
     
     if (memberData && memberData.length > 0) {
       const teamIds = memberData.map(m => m.team_id);
       const { data: teamsData } = await supabase
         .from('teams')
         .select('*')
         .in('id', teamIds);
       
       if (teamsData) {
         setTeams(teamsData as Team[]);
         if (!currentTeam && teamsData.length > 0) {
           setCurrentTeam(teamsData[0] as Team);
         }
       }
     } else {
       setTeams([]);
     }
     setLoading(false);
   };
 
   useEffect(() => {
     if (user) {
       refreshTeams();
     } else {
       setTeams([]);
       setCurrentTeam(null);
       setCurrentChannel(null);
       setLoading(false);
     }
   }, [user]);
 
   useEffect(() => {
     const fetchChannels = async () => {
       if (!currentTeam) {
         setChannels([]);
         setCurrentChannel(null);
         return;
       }
       
       const { data } = await supabase
         .from('channels')
         .select('*')
         .eq('team_id', currentTeam.id)
         .order('created_at', { ascending: true });
       
       if (data) {
         setChannels(data as Channel[]);
         if (!currentChannel || currentChannel.team_id !== currentTeam.id) {
           setCurrentChannel(data[0] as Channel || null);
         }
       }
     };
     
     fetchChannels();
   }, [currentTeam]);
 
    useEffect(() => {
      const fetchMembers = async () => {
        if (!currentTeam) {
          setTeamMembers([]);
          return;
        }
        
        // First get team members
        const { data: membersData } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', currentTeam.id);
        
        if (membersData && membersData.length > 0) {
          // Then get profiles for these members
          const userIds = membersData.map(m => m.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', userIds);
          
          // Map profiles to members
          const membersWithProfiles = membersData.map(member => ({
            ...member,
            profile: profilesData?.find(p => p.user_id === member.user_id) as Profile || {
              id: '',
              user_id: member.user_id,
              username: 'Unknown',
              display_name: null,
              avatar_url: null,
              status: 'offline',
              last_seen: null,
              created_at: '',
              updated_at: '',
            },
          }));
          setTeamMembers(membersWithProfiles);
        } else {
          setTeamMembers([]);
        }
      };
      
      fetchMembers();
    }, [currentTeam]);
 
     const createTeam = async (name: string, description?: string): Promise<Team | null> => {
       if (!user) return null;
       if (name.length > 100) return null;
       
      const { data: teamId, error } = await supabase
        .rpc('create_team_with_defaults', {
          _name: name,
          _description: description || null,
        });
      
      if (error || !teamId) return null;
      
      await refreshTeams();
      
      // Fetch the newly created team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();
      
      if (teamData) {
        setCurrentTeam(teamData as Team);
        return teamData as Team;
      }
      
      return null;
    };
 
    const joinTeam = async (inviteCode: string): Promise<boolean> => {
      if (!user) return false;
      
      const { data: teamId, error } = await supabase
        .rpc('join_team_by_invite_code', { code: inviteCode.trim() });
      
      if (error || !teamId) return false;
      
      await refreshTeams();
      
      // Fetch the team we just joined to set as current
      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();
      
      if (team) {
        setCurrentTeam(team as Team);
      }
      
      return true;
    };
 
    const createChannel = async (name: string, description?: string): Promise<Channel | null> => {
      if (!user || !currentTeam) return null;
      if (name.length > 100) return null;
      
     const { data, error } = await supabase
       .from('channels')
       .insert({
         team_id: currentTeam.id,
         name: name.toLowerCase().replace(/\s+/g, '-'),
         description,
         created_by: user.id,
       })
       .select()
       .single();
     
     if (error || !data) return null;
     
     setChannels(prev => [...prev, data as Channel]);
     return data as Channel;
   };
 
   return (
     <TeamContext.Provider value={{
       teams,
       currentTeam,
       currentChannel,
       channels,
       teamMembers,
       loading,
       setCurrentTeam,
       setCurrentChannel,
       createTeam,
       joinTeam,
       createChannel,
       refreshTeams,
     }}>
       {children}
     </TeamContext.Provider>
   );
 };
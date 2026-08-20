const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/NotificationAdminPage.tsx', 'utf8');

code = code.replace(
`import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebase/config';`,
`import { supabase } from '../../lib/supabaseClient';`
);

code = code.replace(
`    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', ''),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
    });
    return () => unsub();`,
`    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', '')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (data) {
        setRecentNotifs(data.map(d => ({
          id: d.id,
          userId: d.user_id,
          title: d.title,
          body: d.body,
          type: d.type,
          link: d.link,
          isRead: d.is_read,
          createdAt: d.created_at,
          projectId: d.project_id
        } as AppNotification)));
      }
    };
    fetchNotifs();
    const channel = supabase.channel('notifs_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: "user_id=eq." }, () => {
        fetchNotifs();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };`
);

fs.writeFileSync('src/pages/admin/NotificationAdminPage.tsx', code);

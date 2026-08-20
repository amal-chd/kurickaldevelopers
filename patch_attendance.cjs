const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AttendanceDashboardPage.tsx', 'utf8');

code = code.replace(
`        const snap = await getDocs(
          query(
            collection(db, 'attendance'),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
          )
        );
        const allRecords: any[] = [];
        snap.forEach(doc => allRecords.push({ id: doc.id, ...doc.data() }));
        setRecords(allRecords);`,
`        const { supabase } = await import('../../lib/supabaseClient');
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate);
        
        if (error) throw error;
        
        const allRecords: any[] = (data || []).map(row => ({
          id: row.id,
          userId: row.user_id,
          date: row.date,
          status: row.status,
          checkInTime: row.check_in_time,
          checkOutTime: row.check_out_time,
          location: row.location,
          notes: row.notes,
          projectId: row.project_id
        }));
        setRecords(allRecords);`
);

fs.writeFileSync('src/pages/admin/AttendanceDashboardPage.tsx', code);

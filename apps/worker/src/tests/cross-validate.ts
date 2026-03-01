import pg from 'pg';

async function crossValidate() {
    console.log('🔍 Starting Phase 10 Cross-Validation (DB Check)...\n');

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/job_tracking',
    });

    const client = await pool.connect();

    try {
        // --- 1. Check Companies Table Schema ---
        console.log('--- 1. Checking Companies Table Schema ---');
        const compCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'companies' 
            AND column_name IN ('logo_url', 'hero_image_url', 'root_domain');
        `);

        const foundCompCols = compCols.rows.map(r => r.column_name);
        console.log('Found Company Columns:', foundCompCols);

        if (foundCompCols.includes('logo_url') && foundCompCols.includes('root_domain')) {
            console.log(' ✅ PASS: Branding columns exist in companies table.');
        } else {
            console.error(' ❌ FAIL: Missing branding columns in companies table.');
        }

        // --- 2. Check Jobs Table Schema ---
        console.log('\n--- 2. Checking Jobs Table Schema ---');
        const jobCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'jobs' 
            AND column_name IN ('quality_score', 'parse_method');
        `);

        const foundJobCols = jobCols.rows.map(r => r.column_name);
        console.log('Found Job Columns:', foundJobCols);

        if (foundJobCols.includes('quality_score') && foundJobCols.includes('parse_method')) {
            console.log(' ✅ PASS: Quality metrics columns exist in jobs table.');
        } else {
            console.error(' ❌ FAIL: Missing quality metrics columns in jobs table.');
        }

        // --- 3. Check Parse Method Enum ---
        console.log('\n--- 3. Checking Parse Method Enum ---');
        try {
            const enumCheck = await client.query(`
                SELECT enumlabel 
                FROM pg_enum 
                JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
                WHERE pg_type.typname = 'parse_method';
            `);
            const labels = enumCheck.rows.map(r => r.enumlabel);
            console.log('Enum Labels:', labels);
            if (labels.includes('LLM_FALLBACK') && labels.includes('ATS_API')) {
                console.log(' ✅ PASS: parse_method enum updated correctly.');
            } else {
                console.error(' ❌ FAIL: parse_method enum missing expected values.');
            }
        } catch (e) {
            console.error(' ❌ FAIL: Could not verify parse_method enum.');
        }

        console.log('\n✨ Database cross-validation completed.');

    } catch (err) {
        console.error('Validation error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

crossValidate();

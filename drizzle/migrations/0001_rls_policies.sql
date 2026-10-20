-- Enable RLS on user-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE views ENABLE ROW LEVEL SECURITY;

-- Policies for 'users' table
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (supabase_uid = auth.uid()::text);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (supabase_uid = auth.uid()::text);

-- Policies for 'companies' table
CREATE POLICY "Users can manage their own companies" ON companies
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));

-- Policies for 'applications' table
CREATE POLICY "Users can manage their own applications" ON applications
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));

-- Policies for 'job_analyses' table
CREATE POLICY "Users can manage their own job analyses" ON job_analyses
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));

-- Policies for 'user_tags' table
CREATE POLICY "Users can manage their own tags" ON user_tags
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));

-- Policies for 'views' table
CREATE POLICY "Users can manage their own views" ON views
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));

-- Special policy for 'jobs' table (public viewable, but company scoped if needed)
-- Since jobs are shared but tied to companies, and companies are private, 
-- users can only see jobs via their companies.
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view jobs from their companies" ON jobs
    FOR SELECT USING (company_id IN (SELECT id FROM companies WHERE user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text)));

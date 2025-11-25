-- Create user_availability table to store individual user availability slots
CREATE TABLE user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint: start_time must be before end_time
  CONSTRAINT valid_time_range CHECK (start_time < end_time),
  
  -- Index for efficient queries by circle and user
  UNIQUE(circle_id, user_id, start_time, end_time)
);

-- Create indexes for common queries
CREATE INDEX idx_user_availability_circle_id ON user_availability(circle_id);
CREATE INDEX idx_user_availability_user_id ON user_availability(user_id);
CREATE INDEX idx_user_availability_circle_user ON user_availability(circle_id, user_id);
CREATE INDEX idx_user_availability_start_time ON user_availability(start_time);

-- Enable Row Level Security
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view/modify their own availability or availability within their circles
CREATE POLICY "Users can view availability for their circles"
  ON user_availability
  FOR SELECT
  USING (
    -- User must be a member of the circle
    EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = user_availability.circle_id
      AND circle_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own availability"
  ON user_availability
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = user_availability.circle_id
      AND circle_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own availability"
  ON user_availability
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own availability"
  ON user_availability
  FOR DELETE
  USING (user_id = auth.uid());

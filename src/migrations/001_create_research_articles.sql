-- ============================================================
-- Migration: Create researches and research_articles tables
-- Description: Stores research sessions and their articles
-- Author: Claude Code
-- Date: 2025-11-17
-- ============================================================

-- ============================================================
-- Create researches table (parent table for research sessions)
-- ============================================================

CREATE TABLE IF NOT EXISTS researches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- Research metadata
  topic TEXT NOT NULL,
  original_query TEXT NOT NULL,
  work_type VARCHAR(100), -- 'artigo', 'dissertação', 'tese', etc
  section VARCHAR(100), -- 'introdução', 'metodologia', 'revisão', etc

  -- Strategy info
  strategy_data JSONB, -- Complete search strategy
  content_outline JSONB, -- Content outline from Etapa 1

  -- Progress tracking
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'archived'
  current_phase VARCHAR(50) DEFAULT 'search', -- 'search', 'analysis', 'generation'

  -- Statistics
  total_articles_found INTEGER DEFAULT 0,
  articles_with_fulltext INTEGER DEFAULT 0,
  knowledge_graph_generated BOOLEAN DEFAULT false,
  content_generated BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes for researches
CREATE INDEX idx_researches_user_id ON researches(user_id);
CREATE INDEX idx_researches_status ON researches(status);
CREATE INDEX idx_researches_created_at ON researches(created_at DESC);

COMMENT ON TABLE researches IS 'Stores research sessions linking queries, articles, and generated content';

-- ============================================================
-- Create research_articles table (child table)
-- ============================================================
CREATE TABLE IF NOT EXISTS research_articles (
  id SERIAL PRIMARY KEY,
  research_id INTEGER NOT NULL REFERENCES researches(id) ON DELETE CASCADE,

  -- External identifiers
  external_id VARCHAR(500) UNIQUE, -- OpenAlex ID, arXiv ID, DOI, etc
  doi VARCHAR(500),
  openalex_id VARCHAR(500),
  arxiv_id VARCHAR(100),
  pubmed_id VARCHAR(100),
  pmc_id VARCHAR(100),

  -- Basic metadata
  title TEXT NOT NULL,
  abstract TEXT,
  year INTEGER,
  publication_date DATE,

  -- Authors (stored as JSONB array)
  authors JSONB DEFAULT '[]'::jsonb,

  -- Publication info
  journal VARCHAR(500),
  volume VARCHAR(50),
  issue VARCHAR(50),
  pages VARCHAR(100),
  publisher VARCHAR(500),

  -- Citation data
  citations INTEGER DEFAULT 0,
  references_count INTEGER DEFAULT 0,

  -- Content
  fulltext TEXT, -- Extracted fulltext content
  fulltext_url TEXT,
  pdf_url TEXT,
  has_fulltext BOOLEAN DEFAULT false,

  -- Source and quality
  source VARCHAR(50) NOT NULL, -- 'openalex', 'arxiv', 'europepmc', 'semanticscholar'
  score FLOAT DEFAULT 0, -- Article relevance score (0-100)

  -- Additional metadata
  keywords JSONB DEFAULT '[]'::jsonb,
  topics JSONB DEFAULT '[]'::jsonb,
  concepts JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional flexible metadata

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_score CHECK (score >= 0 AND score <= 100)
);

-- ============================================================
-- Indexes for performance
-- ============================================================

-- Primary lookup indexes
CREATE INDEX idx_research_articles_research_id ON research_articles(research_id);
CREATE INDEX idx_research_articles_external_id ON research_articles(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_research_articles_doi ON research_articles(doi) WHERE doi IS NOT NULL;

-- Score and quality indexes
CREATE INDEX idx_research_articles_score ON research_articles(score DESC);
CREATE INDEX idx_research_articles_has_fulltext ON research_articles(has_fulltext) WHERE has_fulltext = true;

-- Source and year indexes
CREATE INDEX idx_research_articles_source ON research_articles(source);
CREATE INDEX idx_research_articles_year ON research_articles(year DESC) WHERE year IS NOT NULL;

-- Composite index for common queries (research + score)
CREATE INDEX idx_research_articles_research_score ON research_articles(research_id, score DESC);

-- Full-text search index on title and abstract
CREATE INDEX idx_research_articles_title_search ON research_articles USING gin(to_tsvector('english', title));
CREATE INDEX idx_research_articles_abstract_search ON research_articles USING gin(to_tsvector('english', COALESCE(abstract, '')));

-- ============================================================
-- Trigger to auto-update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_research_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_research_articles_updated_at
  BEFORE UPDATE ON research_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_research_articles_updated_at();

-- ============================================================
-- Comments for documentation
-- ============================================================

COMMENT ON TABLE research_articles IS 'Stores all articles found during research flow phases';
COMMENT ON COLUMN research_articles.external_id IS 'Primary external identifier (OpenAlex ID, arXiv ID, DOI, etc)';
COMMENT ON COLUMN research_articles.score IS 'Article relevance score (0-100) calculated during search';
COMMENT ON COLUMN research_articles.fulltext IS 'Extracted fulltext content from PDF or API';
COMMENT ON COLUMN research_articles.metadata IS 'Flexible JSONB field for additional source-specific metadata';

-- ============================================================
-- Trigger for researches table
-- ============================================================

CREATE OR REPLACE FUNCTION update_researches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_researches_updated_at
  BEFORE UPDATE ON researches
  FOR EACH ROW
  EXECUTE FUNCTION update_researches_updated_at();

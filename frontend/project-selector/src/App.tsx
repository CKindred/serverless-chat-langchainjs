import React, { useState } from "react"
import "./App.css"

interface Project {
  id: string
  name: string
  description: string
  justification: string
}

interface ApiResponse {
  response: {
    projects: Project[]
  }
}

const LoadingSpinner: React.FC = () => {
  return <div className="spinner"></div>
}

const BidQuestionForm: React.FC = () => {
  const [bidQuestion, setBidQuestion] = useState("")
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setIsProcessing(true)
    setError(null)
    setSelectedProjects([])

    try {
      const response = await fetch("api/identify-projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: bidQuestion,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch")
      }

      const data = await response.json()
      // Add unique IDs to each project
      data.response.projects = data.response.projects.map((project: Project, index: number) => ({
        ...project,
        id: `project-${index}`,
      }))
      setApiResponse(data)
    } catch (err) {
      setError("An error occurred while submitting the bid question.")
      console.error("Error:", err)
    } finally {
      setIsLoading(false)
      setIsProcessing(false)
    }
  }

  const handleCheckboxChange = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    )
  }

  const handleUseSelectedProjects = () => {
    // TODO: Implement the logic to move to the next page with selected projects
    console.log("Selected projects:", selectedProjects)
  }

  return (
    <div className="container">
      {/* Left side - Form */}
      <div className="form-container">
        <h1 className="heading">Bid Question Form</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="bidQuestion" className="label">
              Enter your bid question (100-200 words):
            </label>
            <textarea
              id="bidQuestion"
              value={bidQuestion}
              onChange={(e) => setBidQuestion(e.target.value)}
              className="textarea"
              required
            />
          </div>
          <button type="submit" disabled={isLoading} className="button">
            {isLoading ? (
              <>
                <LoadingSpinner />
                <span>Submitting...</span>
              </>
            ) : (
              "Submit"
            )}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {/* Right side - Response */}
      <div className="response-container">
        <h2 className="heading">API Response:</h2>
        {isProcessing ? (
          <div className="processing">
            <LoadingSpinner />
            <span>Processing your request. Please wait...</span>
          </div>
        ) : apiResponse ? (
          <>
            <div className="projects-container">
              {apiResponse.response.projects.map((project) => (
                <div key={project.id} className="project-wrapper">
                  <table className="table">
                    <tbody>
                    <tr>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          id={`checkbox-${project.id}`}
                          checked={selectedProjects.includes(project.id)}
                          onChange={() => handleCheckboxChange(project.id)}
                          className="checkbox"
                        />
                      </td>
                      <td className="table-cell">
                        <h3 className="project-name">{project.name}</h3>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="table-cell">
                        <div className="content">
                          <h4>Description:</h4>
                          <TextRenderer text={project.description} />
                          <h4>Justification:</h4>
                          <TextRenderer text={project.justification} />
                        </div>
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <button
              onClick={handleUseSelectedProjects}
              className="use-selected-button"
              disabled={selectedProjects.length === 0}
            >
              Use selected project(s)
            </button>
          </>
        ) : (
          <p className="no-response">No response yet. Submit a bid question to see the results.</p>
        )}
      </div>
    </div>
  )
}

interface TextRendererProps {
  text: string
}

const TextRenderer: React.FC<TextRendererProps> = ({ text }) => {
  const paragraphs = text.split("\\n\\n").map((paragraph, index) => (
    <p key={index}>
      {paragraph.split("\\n").map((line, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {line}
          <br />
        </React.Fragment>
      ))}
    </p>
  ))

  return <div>{paragraphs}</div>
}

export default BidQuestionForm


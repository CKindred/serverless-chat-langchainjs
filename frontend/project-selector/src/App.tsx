import React, { useState } from "react"
import "./App.css"

interface ApiResponse {
  response: {
    name: string
    description: string
    justification: string
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setIsProcessing(true)
    setError(null)

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
      setApiResponse(data)
    } catch (err) {
      setError("An error occurred while submitting the bid question.")
      console.error("Error:", err)
    } finally {
      setIsLoading(false)
      setIsProcessing(false)
    }
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
            Submit
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {/* Right side - Response */}
      <div className="response-container">
        <h2 className="heading">AI Response</h2>
        {isProcessing ? (
          <div className="processing">
            <LoadingSpinner />
            <span>Processing your request. Please wait...</span>
          </div>
        ) : apiResponse ? (
          <table className="table">
            <tbody>
            <tr>
              <td className="checkmark-cell">✓</td>
              <td className="table-cell">
                <h3 className="project-name">{apiResponse.response.name}</h3>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="table-cell">
                <div className="content">
                  <TextRenderer text={apiResponse.response.description} />
                  <TextRenderer text={apiResponse.response.justification} />
                </div>
              </td>
            </tr>
            </tbody>
          </table>
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


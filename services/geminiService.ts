import { GoogleGenAI, Type } from "@google/genai";
import type { AnalyzedEmployee, RankedEmployee, TaskAssignment } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeResumeFromPdfImages = async (
    pdfImages: { mimeType: string, data: string }[]
): Promise<{ summary: string; skills: string[]; experienceYears: number; }> => {
    try {
        const imageParts = pdfImages.map(image => ({
            inlineData: {
                mimeType: image.mimeType,
                data: image.data,
            }
        }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    ...imageParts,
                    { text: "Analyze the resume from the provided image(s). Extract a concise professional summary, a list of key skills, and the total years of professional experience as a number. Provide the output in a structured JSON format." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "A concise professional summary of the candidate." },
                        skills: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "A list of the candidate's key technical and soft skills."
                        },
                        experienceYears: { type: Type.NUMBER, description: "Total years of professional experience." }
                    },
                    required: ["summary", "skills", "experienceYears"]
                }
            }
        });

        return JSON.parse(response.text);

    } catch (error) {
        console.error("Error analyzing resume:", error);
        throw new Error("Failed to analyze resume with Gemini API.");
    }
};


export const rankEmployees = async (employees: AnalyzedEmployee[]): Promise<RankedEmployee[]> => {
    try {
        const employeeData = employees.map(({ id, name, summary, skills, experienceYears }) => ({ id, name, summary, skills, experienceYears }));
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze the following employee data. Based on their summary, skills, and years of experience, assign a rank from 1 to 100 to each employee, where 100 is the most qualified. Provide a brief justification for each rank. The employee data is provided as a JSON string: ${JSON.stringify(employeeData)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            rank: { type: Type.INTEGER },
                            justification: { type: Type.STRING },
                        },
                        required: ["id", "rank", "justification"]
                    }
                }
            }
        });

        const rankedData: { id: string; rank: number; justification: string; }[] = JSON.parse(response.text);
        
        const rankedEmployees = employees.map(emp => {
            const ranking = rankedData.find(r => r.id === emp.id);
            if (ranking) {
                return { ...emp, ...ranking };
            }
            return { ...emp, rank: 0, justification: 'Not ranked' };
        });

        return rankedEmployees.sort((a, b) => b.rank - a.rank);

    } catch (error) {
        console.error("Error ranking employees:", error);
        throw new Error("Failed to rank employees with Gemini API.");
    }
};

export const distributeTasks = async (employees: RankedEmployee[], tasks: string[]): Promise<TaskAssignment[]> => {
    try {
        const employeeData = employees.map(({ id, name, rank, skills }) => ({ id, name, rank, skills }));

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Here is a list of ranked employees with their skills: ${JSON.stringify(employeeData)}. And here is a list of daily tasks: ${JSON.stringify(tasks)}. Distribute the tasks to the most suitable employees based on their rank and skills. Assign tasks fairly and efficiently. Each task should be assigned to only one employee.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            employeeId: { type: Type.STRING },
                            tasks: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ["employeeId", "tasks"]
                    }
                }
            }
        });

        const assignments: TaskAssignment[] = JSON.parse(response.text);
        return assignments;
    } catch (error) {
        console.error("Error distributing tasks:", error);
        throw new Error("Failed to distribute tasks with Gemini API.");
    }
};